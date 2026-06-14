import { useRef, useState, useCallback, useEffect } from 'react';

// ── Layout constants ─────────────────────────────────────────────────────────
const HOUR_START  = 0;        // start at midnight (auto-scroll brings to current time)
const HOUR_END    = 24;
const TOTAL_HRS   = HOUR_END - HOUR_START;
const ROW_H       = 48;       // px per hour  (12px per 15 min)
const TOTAL_H     = TOTAL_HRS * ROW_H;
const GUTTER_W    = 52;
const RESIZE_PX   = 8;        // bottom drag zone height
const SNAP        = 15;       // minute snap

// ── Google Calendar exact palette ────────────────────────────────────────────
const C = {
  hourLine:    '#dadce0',
  halfLine:    'rgba(218,220,224,.4)',
  timeLbl:     '#70757a',
  dayLbl:      '#70757a',
  dateLbl:     '#3c4043',
  todayCircle: '#1a73e8',
  todayBg:     '#f8f9fa',
  nowDot:      '#ea4335',
  nowLine:     '#ea4335',
  ghostBg:     'rgba(26,115,232,.18)',
  ghostBorder: '#1a73e8',
  headerBg:    '#fff',
  bodyBg:      '#fff',
  surface:     '#fff',
};

const STATUS_COLOR = {
  scheduled: '#1a73e8',
  conducted: '#0b8043',
  postponed: '#e37400',
  missed:    '#d93025',
  cancelled: '#80868b',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minToTime(min) {
  const c = Math.max(0, Math.min(min, 23*60+59));
  return `${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`;
}
function snapMin(raw) { return Math.round(raw / SNAP) * SNAP; }
function fmtDisp(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hr} ${ap}` : `${hr}:${String(m).padStart(2,'0')} ${ap}`;
}
function getWeekDays(ws) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + i); return d;
  });
}

const DOW3   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MON3   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const HOURS  = Array.from({ length: TOTAL_HRS }, (_, i) => HOUR_START + i);

// ── EventPopover ─────────────────────────────────────────────────────────────
function EventPopover({ event: m, anchor, onEdit, onCancel, onClose }) {
  const A = m.pair?.unit_a, B = m.pair?.unit_b;
  const pairLabel = A && B ? `${A.name} × ${B.name}` : '';
  const eventTitle = m.title || (A && B ? `${A.abbr} × ${B.abbr}` : 'Meeting');
  const color = m.status === 'cancelled' ? STATUS_COLOR.cancelled
              : (A?.color || STATUS_COLOR[m.status] || STATUS_COLOR.scheduled);

  // Position: prefer right of anchor, flip left if too close to edge
  let left = anchor.right + 10;
  let top  = Math.max(60, anchor.top - 10);
  if (left + 300 > window.innerWidth)  left = anchor.left - 310;
  if (top  + 320 > window.innerHeight) top  = window.innerHeight - 330;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1099 }} />
      <div style={{
        position:'fixed', left, top, zIndex:1100, width:290,
        background:'#fff', borderRadius:8,
        boxShadow:'0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3)',
        overflow:'hidden', fontFamily:'Google Sans,Roboto,sans-serif',
      }}>
        {/* Color header strip */}
        <div style={{ background:color, height:8 }} />
        <div style={{ padding:'10px 16px 16px' }}>
          {/* Top action row */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:2, marginBottom:8 }}>
            {[
              { icon:'✎', title:'Edit',   action: onEdit   },
              { icon:'🗑',title:'Cancel', action: onCancel },
              { icon:'✕', title:'Close',  action: onClose  },
            ].map(b => (
              <button key={b.title} type="button" title={b.title} onClick={b.action}
                style={{ border:'none', background:'none', cursor:'pointer', width:32, height:32, borderRadius:'50%', fontSize:14, color:'#5f6368', display:'flex', alignItems:'center', justifyContent:'center' }}
                onMouseEnter={e=>e.currentTarget.style.background='#f1f3f4'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}
              >{b.icon}</button>
            ))}
          </div>

          {/* Title */}
          <div style={{ fontSize:18, fontWeight:400, color:'#3c4043', lineHeight:1.4, marginBottom:12 }}>
            {eventTitle}
          </div>

          {/* Date + time */}
          <Row icon="🕐">
            <div style={{ fontSize:13, color:'#3c4043' }}>{m.date}</div>
            {(m.time || m.end_time) && (
              <div style={{ fontSize:12, color:'#5f6368', marginTop:2 }}>
                {fmtDisp(m.time)}{m.end_time ? ` – ${fmtDisp(m.end_time)}` : ''}
                {m.recurrence && m.recurrence !== 'none' && ` · ${m.recurrence}`}
              </div>
            )}
          </Row>

          {/* Pair */}
          {pairLabel && (
            <Row icon="👥">
              <span style={{ fontSize:13, color:'#3c4043', display:'flex', alignItems:'center', gap:5 }}>
                {A && <span style={{ width:8, height:8, borderRadius:'50%', background:A.color, display:'inline-block', flexShrink:0 }} />}
                {A?.abbr} ×
                {B && <span style={{ width:8, height:8, borderRadius:'50%', background:B.color, display:'inline-block', flexShrink:0 }} />}
                {B?.abbr}
              </span>
            </Row>
          )}

          {/* Meet link */}
          {m.meet_link && (
            <Row icon="📹">
              <a href={m.meet_link} target="_blank" rel="noreferrer"
                style={{ fontSize:12, color:'#1a73e8', wordBreak:'break-all' }}>
                Join with Google Meet
              </a>
            </Row>
          )}

          {/* Status */}
          <Row icon="●" iconColor={color}>
            <span style={{ fontSize:12, color, fontWeight:500, textTransform:'capitalize' }}>{m.status}</span>
          </Row>

          {/* Description */}
          {m.description && (
            <div style={{ marginTop:10, fontSize:12, color:'#5f6368', lineHeight:1.5, maxHeight:72, overflowY:'auto', borderTop:'1px solid #e8eaed', paddingTop:8 }}
              dangerouslySetInnerHTML={{ __html: m.description }} />
          )}
        </div>
      </div>
    </>
  );
}

function Row({ icon, iconColor, children }) {
  return (
    <div style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
      <span style={{ fontSize:15, flexShrink:0, marginTop:1, color: iconColor || 'inherit', lineHeight:1 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>{children}</div>
    </div>
  );
}

// ── WeekCalendar ─────────────────────────────────────────────────────────────
export default function WeekCalendar({
  weekStart,
  meetings,
  onSlotClick,     // (date: Date, startMin, endMin)
  onDragCreate,    // (date: Date, startMin, endMin)
  onEventEdit,     // (meeting)
  onEventCancel,   // (meeting)
  onEventMove,     // (meeting, newDateIso, newStartTime, newEndTime)
  onEventResize,   // (meeting, newEndTime)
  height,          // optional override, default calc(100vh - 148px)
}) {
  const days     = getWeekDays(weekStart);
  const now      = new Date();
  const todayIso = isoDate(now);
  const scrollEl = useRef(null);
  const colRef   = useRef({});

  // Drag state (ref, no re-renders during drag)
  const dragRef = useRef(null);
  // Ghost visual state (triggers re-renders)
  const [ghost,   setGhost]   = useState(null);
  const [popover, setPopover] = useState(null); // { meeting, anchor{top,left,right,bottom} }
  const [nowTop,  setNowTop]  = useState(0);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollEl.current) {
      const nowMin = now.getHours()*60 + now.getMinutes();
      scrollEl.current.scrollTop = Math.max(0, (nowMin - HOUR_START*60)/60*ROW_H - 120);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update now-line every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowTop((n.getHours()*60 + n.getMinutes() - HOUR_START*60)/60 * ROW_H);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Y clientY → minutes
  const minFromY = useCallback((clientY, colEl) => {
    const rect = colEl.getBoundingClientRect();
    const relY  = clientY - rect.top;
    const frac  = relY / TOTAL_H;
    return snapMin(HOUR_START*60 + Math.max(0, Math.min(frac, 1)) * TOTAL_HRS * 60);
  }, []);

  // Find which day column the cursor is in
  const dayFromX = useCallback((clientX) => {
    let best = null, bestDist = Infinity;
    for (const day of days) {
      const iso = isoDate(day);
      const el  = colRef.current[iso];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const d  = Math.abs(clientX - cx);
      if (d < bestDist) { bestDist = d; best = day; }
    }
    return best;
  }, [days]);

  // ── mousedown on empty column (create) ───────────────────────────────────
  const onColDown = useCallback((e, day) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-ev]')) return;
    e.preventDefault();
    const colEl = colRef.current[isoDate(day)];
    if (!colEl) return;
    const startMin = minFromY(e.clientY, colEl);
    dragRef.current = { type:'create', day, startMin, moved:false };
    setGhost({ type:'create', day, s:startMin, e:startMin+60 });
  }, [minFromY]);

  // ── mousedown on event (move/resize) ─────────────────────────────────────
  const onEvDown = useCallback((e, m) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect    = e.currentTarget.getBoundingClientRect();
    const isRsz   = (e.clientY > rect.bottom - RESIZE_PX);
    const sMin    = timeToMin(m.time);
    const eMin    = m.end_time ? timeToMin(m.end_time) : sMin + 60;
    if (isRsz) {
      dragRef.current = { type:'resize', m, eMin, moved:false, anchorRect:rect };
      setGhost({ type:'resize', m, eMin });
    } else {
      const colEl  = colRef.current[m.date];
      const mouseMin = colEl ? minFromY(e.clientY, colEl) : sMin;
      dragRef.current = { type:'move', m, offset: mouseMin-sMin, day: days.find(d=>isoDate(d)===m.date)||days[0], sMin, eMin, moved:false, anchorRect:rect };
      setGhost({ type:'move', m, day: days.find(d=>isoDate(d)===m.date)||days[0], sMin, eMin });
    }
  }, [minFromY, days]);

  // ── global move ───────────────────────────────────────────────────────────
  const onMove = useCallback((e) => {
    const dr = dragRef.current;
    if (!dr) return;
    if (!dr.moved) dr.moved = true;

    if (dr.type === 'create') {
      const colEl = colRef.current[isoDate(dr.day)];
      if (!colEl) return;
      const end = minFromY(e.clientY, colEl);
      setGhost(g => g ? { ...g, e: Math.max(g.s+SNAP, end) } : null);

    } else if (dr.type === 'move') {
      const targetDay = dayFromX(e.clientX) || dr.day;
      const iso       = isoDate(targetDay);
      const colEl     = colRef.current[iso];
      if (!colEl) return;
      const mouseMin  = minFromY(e.clientY, colEl);
      const dur       = dr.eMin - dr.sMin;
      const newS      = snapMin(mouseMin - dr.offset);
      setGhost(g => g ? { ...g, day:targetDay, sMin:newS, eMin:newS+dur } : null);

    } else if (dr.type === 'resize') {
      const colEl = colRef.current[dr.m.date];
      if (!colEl) return;
      const newEnd = Math.max(timeToMin(dr.m.time)+SNAP, minFromY(e.clientY, colEl));
      setGhost(g => g ? { ...g, eMin:newEnd } : null);
    }
  }, [minFromY, dayFromX]);

  // ── global up ────────────────────────────────────────────────────────────
  const onUp = useCallback(() => {
    const dr = dragRef.current;
    if (!dr) return;
    dragRef.current = null;

    if (dr.type === 'create') {
      const g = ghost;
      setGhost(null);
      if (!g) return;
      if (!dr.moved || Math.abs(g.e - g.s) < SNAP) {
        onSlotClick?.(g.day, g.s, g.s + 60);
      } else {
        onDragCreate?.(g.day, Math.min(g.s,g.e), Math.max(g.s,g.e));
      }

    } else if (dr.type === 'move') {
      const g = ghost;
      setGhost(null);
      if (!dr.moved) {
        // treat as click → show popover
        setPopover({ meeting: dr.m, anchor: dr.anchorRect });
      } else if (g) {
        onEventMove?.(dr.m, isoDate(g.day), minToTime(g.sMin), minToTime(g.eMin));
      }

    } else if (dr.type === 'resize') {
      const g = ghost;
      setGhost(null);
      if (dr.moved && g) {
        onEventResize?.(dr.m, minToTime(g.eMin));
      }
    }
  }, [ghost, onSlotClick, onDragCreate, onEventMove, onEventResize]);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [onMove, onUp]);

  // ── byDay lookup ──────────────────────────────────────────────────────────
  const byDay = {};
  meetings.forEach(m => { (byDay[m.date] = byDay[m.date]||[]).push(m); });

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height: height || 'calc(100vh - 148px)', background:C.bodyBg, borderRadius:8, boxShadow:'0 1px 2px rgba(60,64,67,.3),0 2px 6px rgba(60,64,67,.15)', overflow:'hidden', userSelect:'none' }}>

      {/* ── Day header ── */}
      <div style={{ display:'grid', gridTemplateColumns:`${GUTTER_W}px repeat(7,1fr)`, background:C.headerBg, borderBottom:`1px solid ${C.hourLine}`, flexShrink:0, boxShadow:'0 2px 3px rgba(0,0,0,.1)', zIndex:10 }}>
        {/* GMT corner */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:'8px 6px 10px', borderRight:`1px solid ${C.hourLine}` }}>
          <span style={{ fontSize:9, color:C.timeLbl, fontFamily:'Roboto,sans-serif', letterSpacing:0 }}>
            GMT{new Date().getTimezoneOffset() <= 0 ? `+${-new Date().getTimezoneOffset()/60}` : `-${new Date().getTimezoneOffset()/60}`}
          </span>
        </div>
        {days.map((d, i) => {
          const isToday = isoDate(d) === todayIso;
          return (
            <div key={i} style={{ textAlign:'center', padding:'8px 4px 10px', borderRight: i<6 ? `1px solid ${C.hourLine}` : 'none' }}>
              <div style={{ fontFamily:'Roboto,sans-serif', fontSize:11, fontWeight:500, letterSpacing:'.8px', textTransform:'uppercase', color: isToday ? C.todayCircle : C.dayLbl }}>
                {DOW3[i]}
              </div>
              <div style={{ width:44, height:44, borderRadius:'50%', margin:'4px auto 2px', display:'flex', alignItems:'center', justifyContent:'center', background: isToday ? C.todayCircle : 'transparent' }}>
                <span style={{ fontFamily:'Google Sans,Roboto,sans-serif', fontSize:22, fontWeight:400, color: isToday ? '#fff' : C.dateLbl, lineHeight:1 }}>
                  {d.getDate()}
                </span>
              </div>
              <div style={{ fontFamily:'Roboto,sans-serif', fontSize:10, color:C.timeLbl }}>{MON3[d.getMonth()]}</div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable time grid ── */}
      <div ref={scrollEl} style={{ flex:1, overflowY:'scroll', position:'relative', overscrollBehavior:'contain' }}>
        <div style={{ display:'grid', gridTemplateColumns:`${GUTTER_W}px repeat(7,1fr)`, position:'relative', minHeight:TOTAL_H }}>

          {/* ── Time gutter ── */}
          <div style={{ borderRight:`1px solid ${C.hourLine}`, background:C.headerBg, position:'sticky', left:0, zIndex:5 }}>
            {HOURS.map(h => (
              <div key={h} style={{ height:ROW_H, position:'relative' }}>
                {h > 0 && (
                  <span style={{
                    position:'absolute', top:-8, right:8,
                    fontSize:10, color:C.timeLbl,
                    fontFamily:'Roboto,sans-serif', letterSpacing:0,
                    lineHeight:1, whiteSpace:'nowrap',
                  }}>
                    {h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Day columns ── */}
          {days.map((day, di) => {
            const iso      = isoDate(day);
            const isToday  = iso === todayIso;
            const dayMeets = (byDay[iso] || []).filter(m => m.status !== 'cancelled' || ghost?.type !== 'move' || ghost.m?.id !== m.id);

            return (
              <div key={di} ref={el => colRef.current[iso] = el}
                onMouseDown={e => onColDown(e, day)}
                style={{ position:'relative', borderRight: di<6 ? `1px solid ${C.hourLine}` : 'none', height:TOTAL_H, background: isToday ? C.todayBg : C.bodyBg, cursor:'crosshair' }}
              >
                {/* Grid lines */}
                {HOURS.map(h => (
                  <div key={h} style={{ position:'absolute', top:(h-HOUR_START)*ROW_H, left:0, right:0, height:ROW_H, pointerEvents:'none' }}>
                    <div style={{ borderTop:`1px solid ${C.hourLine}` }} />
                    <div style={{ position:'absolute', top:ROW_H/2, left:0, right:0, borderTop:`1px solid ${C.halfLine}` }} />
                  </div>
                ))}

                {/* Current time line */}
                {isToday && nowTop >= 0 && nowTop <= TOTAL_H && (
                  <div style={{ position:'absolute', top:nowTop, left:0, right:0, zIndex:4, pointerEvents:'none' }}>
                    <div style={{ position:'absolute', left:-4, top:-4, width:8, height:8, borderRadius:'50%', background:C.nowDot }} />
                    <div style={{ borderTop:`2px solid ${C.nowLine}` }} />
                  </div>
                )}

                {/* Drag-create ghost */}
                {ghost?.type === 'create' && isoDate(ghost.day) === iso && (() => {
                  const s = Math.min(ghost.s, ghost.e), e = Math.max(ghost.s, ghost.e);
                  const top = (s - HOUR_START*60)/60 * ROW_H;
                  const h   = Math.max((e-s)/60*ROW_H, 20);
                  return (
                    <div style={{ position:'absolute', top, left:2, right:2, height:h, background:C.ghostBg, border:`2px solid ${C.ghostBorder}`, borderRadius:4, zIndex:6, pointerEvents:'none', padding:'3px 6px', boxSizing:'border-box' }}>
                      <div style={{ fontSize:11, color:C.ghostBorder, fontFamily:'Roboto,sans-serif', fontWeight:500 }}>
                        {fmtDisp(minToTime(s))} – {fmtDisp(minToTime(e))}
                      </div>
                    </div>
                  );
                })()}

                {/* Drag-move ghost */}
                {ghost?.type === 'move' && isoDate(ghost.day) === iso && (() => {
                  const color  = ghost.m.pair?.unit_a?.color || STATUS_COLOR[ghost.m.status] || STATUS_COLOR.scheduled;
                  const top    = (ghost.sMin - HOUR_START*60)/60 * ROW_H;
                  const height = Math.max((ghost.eMin-ghost.sMin)/60*ROW_H, 20);
                  return (
                    <div style={{ position:'absolute', top, left:2, right:2, height, background:color+'aa', border:`2px dashed ${color}`, borderRadius:4, zIndex:6, pointerEvents:'none', padding:'3px 6px', boxSizing:'border-box', opacity:.8 }}>
                      <div style={{ fontSize:11, color:'#fff', fontFamily:'Roboto,sans-serif', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {ghost.m.title || `${ghost.m.pair?.unit_a?.abbr}×${ghost.m.pair?.unit_b?.abbr}`}
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.8)', marginTop:2 }}>
                        {fmtDisp(minToTime(ghost.sMin))} – {fmtDisp(minToTime(ghost.eMin))}
                      </div>
                    </div>
                  );
                })()}

                {/* Event blocks */}
                {dayMeets.map((m, mi) => {
                  const isMoving  = ghost?.type === 'move'   && ghost.m?.id === m.id;
                  const isResizing= ghost?.type === 'resize' && ghost.m?.id === m.id;
                  if (isMoving) return null;

                  const sMin  = timeToMin(m.time) || HOUR_START*60;
                  const eMin  = isResizing ? ghost.eMin : (m.end_time ? timeToMin(m.end_time) : sMin + 60);
                  const top   = (sMin - HOUR_START*60)/60 * ROW_H;
                  const h     = Math.max((eMin - sMin)/60 * ROW_H, 20);
                  const color = m.status === 'cancelled'
                    ? STATUS_COLOR.cancelled
                    : (m.pair?.unit_a?.color || STATUS_COLOR[m.status] || STATUS_COLOR.scheduled);
                  const A = m.pair?.unit_a, B = m.pair?.unit_b;
                  const title = m.title || (A && B ? `${A.abbr} × ${B.abbr}` : 'Meeting');

                  return (
                    <div key={mi} data-ev="1"
                      onMouseDown={e => onEvDown(e, m)}
                      style={{
                        position:'absolute', top, left:2, right:2, height:h,
                        background:color, borderRadius:4, overflow:'hidden',
                        zIndex:3, cursor:'grab', boxSizing:'border-box',
                        padding: h > 28 ? '3px 6px' : '1px 5px',
                        opacity: m.status === 'cancelled' ? 0.5 : 1,
                        boxShadow:'0 1px 2px rgba(0,0,0,.3)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter='brightness(.92)'; e.currentTarget.style.boxShadow='0 2px 6px rgba(0,0,0,.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.filter='none'; e.currentTarget.style.boxShadow='0 1px 2px rgba(0,0,0,.3)'; }}
                    >
                      {/* Title */}
                      <div style={{ fontSize:11, fontWeight:500, color:'#fff', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Google Sans,Roboto,sans-serif' }}>
                        {m.title || (A && B ? `${A.abbr} × ${B.abbr}` : 'Meeting')}
                      </div>
                      {/* Time range (if tall enough) */}
                      {h > 32 && (
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.9)', lineHeight:1.3, fontFamily:'Roboto,sans-serif', marginTop:1 }}>
                          {fmtDisp(m.time)}{m.end_time ? ` – ${fmtDisp(m.end_time)}` : ''}
                        </div>
                      )}
                      {/* Pair label (if tall enough) */}
                      {h > 52 && A && B && (
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', fontFamily:'Roboto,sans-serif', marginTop:1 }}>
                          {A.abbr} × {B.abbr}
                        </div>
                      )}
                      {/* Meet badge */}
                      {m.meet_link && h > 44 && (
                        <div style={{ fontSize:10, color:'rgba(255,255,255,.85)', marginTop:1 }}>📹</div>
                      )}
                      {/* Resize handle */}
                      <div data-ev="1" style={{ position:'absolute', bottom:0, left:0, right:0, height:RESIZE_PX, cursor:'ns-resize', borderRadius:'0 0 4px 4px' }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Event detail popover ── */}
      {popover && (
        <EventPopover
          event={popover.meeting}
          anchor={popover.anchor}
          onEdit={() => { setPopover(null); onEventEdit?.(popover.meeting); }}
          onCancel={() => { setPopover(null); onEventCancel?.(popover.meeting); }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
