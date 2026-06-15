import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WysiwygEditor from './WysiwygEditor';
import DateField from './DateField';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const c = Math.max(0, Math.min(min, 23 * 60 + 59));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}
function fmtDisp(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hr} ${ap}` : `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}
function fmtDateLong(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
function tzLabel() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g,' '); } catch { return 'Local time'; }
}
function randPart(n) {
  return Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]).join('');
}
function generateMeet() {
  return `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const GS   = 'Google Sans,Roboto,sans-serif';
const RI   = 'Roboto,sans-serif';
const BLUE = '#1a73e8';
const BBG  = '#e8f0fe';
const LINE = '#dadce0';
const INK  = '#3c4043';
const INK2 = '#5f6368';
const INK3 = '#80868b';

// ── Icons ─────────────────────────────────────────────────────────────────────
function Ic({ size = 20, color = INK2, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}
const IcClock  = () => <Ic><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>;
const IcRepeat = () => <Ic><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></Ic>;
const IcMapPin = () => <Ic><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></Ic>;
const IcVideo  = () => <Ic><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></Ic>;
const IcUsers  = () => <Ic><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></Ic>;
const IcText   = () => <Ic><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></Ic>;
const IcX      = () => <Ic size={18}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ic>;
const IcEdit   = () => <Ic size={14} color={INK3}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></Ic>;
const IcCheck  = ({ color = BLUE }) => <Ic size={16} color={color}><polyline points="20 6 9 17 4 12"/></Ic>;
function IcStatus({ color }) { return <Ic color={color}><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></Ic>; }

// ── Field row ─────────────────────────────────────────────────────────────────
function FR({ icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '10px 0', alignItems: 'flex-start' }}>
      <div style={{ width: 22, flexShrink: 0, paddingTop: 11, display: 'flex', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ── Thin divider ──────────────────────────────────────────────────────────────
const HR = () => <div style={{ height: 1, background: '#f1f3f4', margin: '0 0' }} />;

// ── Time options (every 15 min) ───────────────────────────────────────────────
const TIME_OPTS = (() => {
  const list = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) {
      const v = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const ap = h >= 12 ? 'PM' : 'AM';
      const hr = h > 12 ? h-12 : h===0 ? 12 : h;
      list.push({ v, l: `${hr}:${String(m).padStart(2,'0')} ${ap}` });
    }
  return list;
})();

// ── Date + Time SANDWICH ──────────────────────────────────────────────────────
// Collapsed: shows "Mon, 13 Jun 2026 · 5:00 PM – 6:00 PM (1h)" as one clickable row
// Expanded:  DateField calendar + start/end time selects (no pre-fills until user picks)
function DateTimeSandwich({ date, startTime, endTime, onDateChange, onStartChange, onEndChange, durStr }) {
  const [open, setOpen] = useState(!date); // start open if no date yet

  const dateLabel  = fmtDateLong(date);
  const startLabel = fmtDisp(startTime);
  const endLabel   = fmtDisp(endTime);
  const hasTimes   = !!(startTime || endTime);

  const timeSelStyle = (val) => ({
    flex: 1, minWidth: 100, border: `1px solid ${LINE}`, borderRadius: 8,
    padding: '8px 10px', fontSize: 13, fontFamily: GS, outline: 'none',
    cursor: 'pointer', background: '#fff',
    color: val ? INK : INK3,
  });

  if (!open && dateLabel) {
    return (
      <div onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          background: '#f8f9fa', border: `1px solid transparent`,
          transition: 'all .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='#f1f3f4'; e.currentTarget.style.borderColor=LINE; }}
        onMouseLeave={e => { e.currentTarget.style.background='#f8f9fa'; e.currentTarget.style.borderColor='transparent'; }}>
        {/* Date */}
        <span style={{ fontFamily: GS, fontSize: 14, fontWeight: 400, color: INK }}>{dateLabel}</span>
        {/* Time range */}
        {hasTimes && (
          <>
            <span style={{ color: '#bdc1c6', fontSize: 16, lineHeight: 1 }}>·</span>
            <span style={{ fontFamily: GS, fontSize: 14, color: INK }}>
              {startLabel || '—'}{' '}<span style={{ color: INK3 }}>–</span>{' '}{endLabel || '—'}
            </span>
            {durStr && (
              <span style={{ fontFamily: RI, fontSize: 11, color: INK3, background: '#e8eaed', borderRadius: 8, padding: '2px 8px' }}>
                {durStr}
              </span>
            )}
          </>
        )}
        <IcEdit />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Date picker */}
      <DateField value={date} onChange={onDateChange} placeholder="Add date" />

      {/* Start – End time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select value={startTime} onChange={e => onStartChange(e.target.value)}
          style={timeSelStyle(startTime)}
          onFocus={e => { e.target.style.borderColor=BLUE; e.target.style.color=INK; }}
          onBlur={e  => { e.target.style.borderColor=LINE; }}>
          <option value="">Start time</option>
          {TIME_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>

        <span style={{ color: INK2, fontFamily: RI, fontSize: 15, flexShrink: 0 }}>–</span>

        <select value={endTime} onChange={e => onEndChange(e.target.value)}
          style={timeSelStyle(endTime)}
          onFocus={e => { e.target.style.borderColor=BLUE; e.target.style.color=INK; }}
          onBlur={e  => { e.target.style.borderColor=LINE; }}>
          <option value="">End time</option>
          {TIME_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>

        {durStr && (
          <span style={{ fontFamily: RI, fontSize: 12, color: INK3, flexShrink: 0, background: '#f1f3f4', borderRadius: 8, padding: '4px 8px' }}>
            {durStr}
          </span>
        )}
      </div>

      {/* Timezone */}
      <div style={{ fontFamily: RI, fontSize: 11, color: INK3, paddingLeft: 2 }}>
        {tzLabel()}
      </div>

      {/* Collapse to sandwich when date is chosen */}
      {dateLabel && (
        <button type="button" onClick={() => setOpen(false)}
          style={{ alignSelf: 'flex-start', border: `1px solid ${LINE}`, borderRadius: 16, padding: '4px 16px', fontSize: 12, fontFamily: GS, cursor: 'pointer', background: '#fff', color: BLUE, fontWeight: 500 }}
          onMouseEnter={e => e.currentTarget.style.background = BBGF}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
          Done
        </button>
      )}
    </div>
  );
}
const BBGF = '#e8f0fe'; // reuse

// ── Custom recurrence panel ────────────────────────────────────────────────────
const DOW7 = ['S','M','T','W','T','F','S'];

function CustomRecurrencePanel({ value, onChange }) {
  const [every,    setEvery]    = useState(value?.every    ?? 1);
  const [unit,     setUnit]     = useState(value?.unit     ?? 'week');
  const [days,     setDays]     = useState(value?.days     ?? []);
  const [ends,     setEnds]     = useState(value?.ends     ?? 'never');
  const [endDate,  setEndDate]  = useState(value?.endDate  ?? '');
  const [endCount, setEndCount] = useState(value?.endCount ?? 5);

  const emit = patch => {
    const next = { every, unit, days, ends, endDate, endCount, ...patch };
    onChange(next);
    if (patch.every    != null) setEvery(patch.every);
    if (patch.unit     != null) setUnit(patch.unit);
    if (patch.days     != null) setDays(patch.days);
    if (patch.ends     != null) setEnds(patch.ends);
    if (patch.endDate  != null) setEndDate(patch.endDate);
    if (patch.endCount != null) setEndCount(patch.endCount);
  };

  const fld = (extra={}) => ({ border:`1px solid ${LINE}`, borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:RI, color:INK, background:'#fff', outline:'none', ...extra });

  return (
    <div style={{ marginTop:8, padding:'16px 18px', background:'#f8f9fa', borderRadius:12, border:`1px solid ${LINE}`, display:'flex', flexDirection:'column', gap:14 }}>
      {/* Every N unit */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontFamily:RI, fontSize:13, color:INK2 }}>Repeat every</span>
        <input type="number" min={1} max={99} value={every}
          onChange={e => emit({ every: Math.max(1, parseInt(e.target.value)||1) })}
          style={{ ...fld({ width:56, textAlign:'center' }) }} />
        <select value={unit} onChange={e => emit({ unit:e.target.value })}
          style={{ ...fld({ cursor:'pointer', minWidth:90 }) }}>
          {['day','week','month','year'].map(u => <option key={u} value={u}>{u}{every>1?'s':''}</option>)}
        </select>
      </div>

      {/* Day-of-week (weekly) */}
      {unit === 'week' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <span style={{ fontFamily:RI, fontSize:12, color:INK2, fontWeight:500 }}>On</span>
          <div style={{ display:'flex', gap:6 }}>
            {DOW7.map((d, i) => {
              const on = days.includes(i);
              return (
                <button key={i} type="button" onClick={() => {
                  const nd = on ? days.filter(x=>x!==i) : [...days,i];
                  emit({ days:nd });
                }}
                  style={{ width:36, height:36, borderRadius:'50%', border:`1.5px solid ${on?BLUE:LINE}`, background:on?BLUE:'#fff', color:on?'#fff':INK, fontFamily:GS, fontSize:12, fontWeight:on?600:400, cursor:'pointer', transition:'all .12s' }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ends */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <span style={{ fontFamily:RI, fontSize:12, color:INK2, fontWeight:500 }}>Ends</span>
        {[['never','Never'],['date','On date'],['count','After']].map(([v,l]) => (
          <label key={v} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <input type="radio" name="recur-ends" value={v} checked={ends===v}
              onChange={() => emit({ ends:v })}
              style={{ accentColor:BLUE, width:15, height:15, flexShrink:0 }} />
            <span style={{ fontFamily:RI, fontSize:13, color:INK, minWidth:60 }}>{l}</span>
            {v==='date' && ends==='date' && (
              <input type="date" value={endDate} onChange={e => emit({ endDate:e.target.value })}
                style={{ ...fld() }} />
            )}
            {v==='count' && ends==='count' && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" min={1} max={999} value={endCount}
                  onChange={e => emit({ endCount:Math.max(1,parseInt(e.target.value)||1) })}
                  style={{ ...fld({ width:64, textAlign:'center' }) }} />
                <span style={{ fontFamily:RI, fontSize:13, color:INK2 }}>
                  occurrence{endCount!==1?'s':''}
                </span>
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Team chips → auto-select pair ────────────────────────────────────────────
// Clicking two unit chips that form a valid pair selects it silently.
// No pair list shown below — chips ARE the selection.
function PairSelect({ pairs, pairId, onPairChange, onNotifyChange }) {
  const units = useMemo(() => {
    const map = {};
    pairs.forEach(p => { map[p.unit_a.id]=p.unit_a; map[p.unit_b.id]=p.unit_b; });
    return Object.values(map).sort((a,b) => a.abbr.localeCompare(b.abbr));
  }, [pairs]);

  // selected unit ids (the chips that are active)
  const [sel, setSel] = useState(() => {
    if (!pairId) return [];
    const p = pairs.find(p => p.id === parseInt(pairId));
    return p ? [p.unit_a.id, p.unit_b.id] : [];
  });

  const toggle = uid => {
    const next = sel.includes(uid) ? sel.filter(x => x !== uid) : [...sel, uid];
    setSel(next);
    // Auto-select pair when exactly two chips form a valid pair
    const matched = pairs.find(p =>
      next.length === 2 &&
      ((p.unit_a.id === next[0] && p.unit_b.id === next[1]) ||
       (p.unit_a.id === next[1] && p.unit_b.id === next[0]))
    );
    if (matched) {
      onPairChange(String(matched.id));
      onNotifyChange(() => [matched.unit_a.id, matched.unit_b.id]);
    } else {
      onPairChange('');
    }
  };

  const selPair = pairId ? pairs.find(p => p.id === parseInt(pairId)) : null;

  // hint when 2 chips are active but don't form a pair
  const noMatch = sel.length === 2 && !selPair;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Unit chips */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {units.map(u => {
          const on = sel.includes(u.id);
          return (
            <button key={u.id} type="button" onClick={() => toggle(u.id)}
              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 13px', border:`1.5px solid ${on?u.color||BLUE:LINE}`, borderRadius:20, cursor:'pointer', background:on?(u.color||BLUE)+'1a':'#fff', fontFamily:GS, fontSize:12, color:on?u.color||BLUE:INK2, fontWeight:on?600:400, transition:'all .12s' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:u.color||BLUE, flexShrink:0, display:'inline-block' }} />
              {u.abbr}
              {on && <IcCheck color={u.color||BLUE} />}
            </button>
          );
        })}
      </div>

      {/* Status line */}
      {selPair ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:RI, fontSize:12, color:'#0b8043' }}>
          <IcCheck color="#0b8043" />
          {selPair.unit_a.abbr} × {selPair.unit_b.abbr} selected
        </div>
      ) : sel.length === 0 ? (
        <div style={{ fontFamily:RI, fontSize:12, color:INK3 }}>Select two teams that form a convergence pair</div>
      ) : sel.length === 1 ? (
        <div style={{ fontFamily:RI, fontSize:12, color:INK3 }}>Select one more team</div>
      ) : noMatch ? (
        <div style={{ fontFamily:RI, fontSize:12, color:'#d93025' }}>These two teams don't have a direct convergence pair</div>
      ) : null}

      {/* Notify row */}
      {selPair && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontFamily:RI, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'.5px' }}>Notify</span>
          {[selPair.unit_a, selPair.unit_b].map(u => (
            <span key={u.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 11px', border:`1.5px solid ${LINE}`, borderRadius:20, background:'#f8f9fa', fontFamily:GS, fontSize:12, color:INK2 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:u.color, display:'inline-block' }} />
              {u.abbr}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { v:'scheduled', l:'Scheduled', color:BLUE      },
  { v:'conducted', l:'Conducted', color:'#0b8043' },
  { v:'postponed', l:'Postponed', color:'#e37400' },
  { v:'missed',    l:'Missed',    color:'#d93025' },
  { v:'cancelled', l:'Cancelled', color:INK3      },
];
const RECURRENCE = [
  { v:'none',    l:'Does not repeat' },
  { v:'daily',   l:'Every day'       },
  { v:'weekly',  l:'Every week'      },
  { v:'monthly', l:'Every month'     },
  { v:'custom',  l:'Custom…'         },
];

// ── Popup position: centred on click, always within viewport ─────────────────
// NOTE: EventModal is portalled to document.body so these coords are always
//       true viewport coords, unaffected by any parent transform/animation.
const NAV_W = 240; // left nav sidebar width (px)

function popupStyle(pos) {
  const W  = 560;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const H  = Math.min(700, vh * 0.92);

  if (!pos) {
    // No click position — centre in the content area (right of nav)
    const cx = NAV_W + (vw - NAV_W) / 2;
    return { top: '50%', left: Math.max(NAV_W + 8, cx - W / 2), transform: 'translateY(-50%)' };
  }

  // Centre popup horizontally on click x, clamped to content area
  let left = pos.x - W / 2;
  left = Math.min(left, vw - W - 12);               // don't overflow right
  left = Math.max(left, NAV_W + 8);                 // don't hide behind nav

  // Place below click; flip above if would overflow bottom
  let top = pos.y + 10;
  if (top + H > vh - 12) top = pos.y - H - 10;
  top = Math.max(60, top);

  return { top, left, transform: 'none' };
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function EventModal({ initial, pairs, meetings, onSave, onClose, saving=false }) {
  const editing  = initial?.meeting ?? null;
  const titleRef = useRef(null);
  const posStyle = useMemo(() => popupStyle(initial?.pos), []); // eslint-disable-line

  const toIso = d => d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    : (d||'');

  const initDate  = editing?.date || toIso(initial?.date) || '';
  // Only pre-fill times from slot-click (initial.startMin) or from existing meeting
  const initStart = editing?.time     || (initial?.startMin != null ? minToTime(initial.startMin) : '');
  const initEnd   = editing?.end_time || (initial?.endMin   != null ? minToTime(initial.endMin)   : '');

  const [title,       setTitle]       = useState(editing?.title       || '');
  const [date,        setDate]        = useState(initDate);
  const [startTime,   setStartTime]   = useState(initStart);
  const [endTime,     setEndTime]     = useState(initEnd);
  const [recurrence,  setRecurrence]  = useState(editing?.recurrence  || 'none');
  const [customRec,   setCustomRec]   = useState(null);
  const [mtype,       setMtype]       = useState(editing?.mtype       || 'In-person');
  const [meetLink,    setMeetLink]    = useState(editing?.meet_link   || '');
  const [pairId,      setPairId]      = useState(editing?.pair?.id ? String(editing.pair.id) : '');
  const [notify,      setNotify]      = useState(() => editing?.notify_units?.map(u=>u.id) || []);
  const [description, setDescription] = useState(editing?.description || '');
  const [meetStatus,  setMeetStatus]  = useState(editing?.status      || 'scheduled');
  const [location,    setLocation]    = useState(editing?.location    || '');

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Auto-extend end to preserve duration when start changes
  const prevStart = useRef(startTime);
  useEffect(() => {
    if (!prevStart.current || !startTime) { prevStart.current = startTime; return; }
    const prevM = timeToMin(prevStart.current);
    const curM  = timeToMin(startTime);
    const endM  = timeToMin(endTime);
    const dur   = endM - prevM;
    if (dur > 0 && dur <= 4*60) setEndTime(minToTime(curM + dur));
    prevStart.current = startTime;
  }, [startTime]); // eslint-disable-line

  const durStr = useMemo(() => {
    if (!startTime || !endTime) return null;
    const d = timeToMin(endTime) - timeToMin(startTime);
    if (d <= 0) return null;
    const h = Math.floor(d/60), m = d%60;
    return h>0 ? (m>0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }, [startTime, endTime]);

  // Conflict detection
  const sMin = timeToMin(startTime), eMin = timeToMin(endTime)||sMin+60;
  const hasConflict = useMemo(() => {
    if (!pairId||!date||!startTime) return false;
    return meetings.filter(m=>m.date===date&&m.id!==editing?.id&&m.status!=='cancelled')
      .some(m=>{ const ms=timeToMin(m.time),me=m.end_time?timeToMin(m.end_time):ms+60; return sMin<me&&eMin>ms; });
  }, [meetings, pairId, date, sMin, eMin, editing]);

  const handleSave = () => {
    if (!pairId || !date) return;
    const payload = {
      pair_id:         parseInt(pairId),
      date,
      title:           title.trim(),
      time:            startTime || null,
      end_time:        endTime   || null,
      description,
      meet_link:       meetLink.trim(),
      recurrence:      recurrence==='custom' ? JSON.stringify(customRec) : recurrence,
      mtype,
      location:        location.trim(),
      notify_unit_ids: notify.map(Number),
    };
    if (editing) payload.status = meetStatus;
    onSave(payload, editing?.id);
  };

  const canSave = !!pairId && !!date && !saving;

  useEffect(() => {
    const h = e => { if ((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&canSave) handleSave(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [canSave]); // eslint-disable-line

  const statusColor = STATUS_OPTIONS.find(s=>s.v===meetStatus)?.color || BLUE;

  const selSty = {
    border:`1px solid ${LINE}`, borderRadius:8, padding:'8px 12px',
    fontSize:14, fontFamily:GS, color:INK, background:'#fff',
    outline:'none', cursor:'pointer', width:'100%',
  };

  return createPortal(
    <>
      {/* Subtle click-away backdrop — no dark overlay, just dismiss on outside click */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1049 }} />
      {/* Popup card — portalled to body so position:fixed is true viewport-relative */}
      <div style={{
        position:'fixed', zIndex:1050,
        width:`min(${560}px,97vw)`,
        ...posStyle,
        background:'#fff', borderRadius:14,
        boxShadow:'0 8px 40px rgba(60,64,67,.30), 0 2px 10px rgba(60,64,67,.18)',
        display:'flex', flexDirection:'column',
        maxHeight:'92vh', overflow:'hidden',
        fontFamily:GS,
      }}>
        {/* Color bar */}
        <div style={{ height:6, background:editing?statusColor:BLUE, flexShrink:0, borderRadius:'14px 14px 0 0' }} />

        {/* Title row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 20px 10px', flexShrink:0, borderBottom:`1px solid #f1f3f4` }}>
          <input ref={titleRef} type="text" value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="Add title"
            style={{ flex:1, border:'none', borderBottom:`2px solid #e8eaed`, borderRadius:0, padding:'6px 0 10px', fontSize:22, fontFamily:GS, fontWeight:400, color:INK, background:'transparent', outline:'none', minWidth:0, transition:'border-color .15s' }}
            onFocus={e=>e.target.style.borderBottomColor=BLUE}
            onBlur={e =>e.target.style.borderBottomColor='#e8eaed'} />
          <button type="button" onClick={onClose}
            style={{ border:'none', background:'none', cursor:'pointer', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:INK2, flexShrink:0 }}
            onMouseEnter={e=>e.currentTarget.style.background='#f1f3f4'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}>
            <IcX />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 20px', display:'flex', flexDirection:'column' }}>

          {/* ── DATE & TIME sandwich ── */}
          <FR icon={<IcClock />}>
            <DateTimeSandwich
              date={date}
              startTime={startTime}
              endTime={endTime}
              onDateChange={setDate}
              onStartChange={setStartTime}
              onEndChange={setEndTime}
              durStr={durStr}
            />
          </FR>

          <HR />

          {/* ── RECURRENCE — full-width select, clearly visible ── */}
          <FR icon={<IcRepeat />}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <select value={recurrence} onChange={e=>setRecurrence(e.target.value)} style={selSty}>
                {RECURRENCE.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {recurrence==='custom' && (
                <CustomRecurrencePanel value={customRec} onChange={setCustomRec} />
              )}
            </div>
          </FR>

          <HR />

          {/* ── LOCATION / TYPE ── */}
          <FR icon={mtype==='Online' ? <IcVideo/> : <IcMapPin/>}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', gap:6 }}>
                {[['In-person','📍'],['Online','💻']].map(([v,ic]) => (
                  <button key={v} type="button"
                    onClick={() => { setMtype(v); if(v==='In-person') setMeetLink(''); }}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, border:`1.5px solid ${mtype===v?BLUE:LINE}`, borderRadius:20, padding:'7px 16px', fontSize:13, fontFamily:GS, cursor:'pointer', transition:'all .12s', background:mtype===v?BBGF:'#fff', color:mtype===v?BLUE:INK2, fontWeight:mtype===v?500:400 }}>
                    <span>{ic}</span>{v}
                  </button>
                ))}
              </div>
              {mtype==='In-person' && (
                <input type="text" value={location} onChange={e=>setLocation(e.target.value)}
                  placeholder="Add location (optional)"
                  style={{ ...selSty, fontSize:13 }}
                  onFocus={e=>{e.target.style.borderColor=BLUE;e.target.style.boxShadow=`0 0 0 2px ${BLUE}22`;}}
                  onBlur={e =>{e.target.style.borderColor=LINE; e.target.style.boxShadow='none';}} />
              )}
              {mtype==='Online' && (
                meetLink ? (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:BBGF, borderRadius:8, border:`1px solid #c5d9f1` }}>
                    <span style={{ fontSize:16 }}>📹</span>
                    <a href={meetLink} target="_blank" rel="noreferrer"
                      style={{ flex:1, fontSize:12, color:BLUE, wordBreak:'break-all', fontFamily:RI, textDecoration:'none' }}>
                      {meetLink}
                    </a>
                    <button type="button" onClick={()=>setMeetLink('')}
                      style={{ border:'none', background:'none', cursor:'pointer', fontSize:11, color:INK2, fontFamily:RI, padding:'2px 6px', borderRadius:4 }}>Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={()=>setMeetLink(generateMeet())}
                    style={{ display:'inline-flex', alignItems:'center', gap:10, border:`1px solid ${LINE}`, borderRadius:8, padding:'9px 14px', fontSize:13, fontFamily:GS, cursor:'pointer', background:'#fff', color:BLUE, fontWeight:500, width:'100%', boxSizing:'border-box', transition:'background .12s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <span style={{ fontSize:18 }}>📹</span>Add Google Meet video conferencing
                  </button>
                )
              )}
            </div>
          </FR>

          <HR />

          {/* ── PAIR / TEAM PICKER ── */}
          <FR icon={<IcUsers />}>
            <PairSelect
              pairs={pairs}
              pairId={pairId}
              onPairChange={id => setPairId(id)}
              onNotifyChange={setNotify}
            />
          </FR>

          {/* ── STATUS (edit only) ── */}
          {editing && (
            <>
              <HR />
              <FR icon={<IcStatus color={statusColor} />}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s.v} type="button" onClick={()=>setMeetStatus(s.v)}
                      style={{ border:`1.5px solid ${meetStatus===s.v?s.color:LINE}`, borderRadius:20, padding:'5px 14px', fontSize:12, fontFamily:GS, cursor:'pointer', transition:'all .12s', background:meetStatus===s.v?s.color+'18':'#fff', color:meetStatus===s.v?s.color:INK2, fontWeight:meetStatus===s.v?600:400 }}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </FR>
            </>
          )}

          <HR />

          {/* ── DESCRIPTION ── */}
          <FR icon={<IcText />}>
            <WysiwygEditor
              value={description}
              onChange={setDescription}
              placeholder="Add meeting agenda or description…"
            />
          </FR>

          {/* Conflict warning */}
          {hasConflict && (
            <div style={{ margin:'6px 0 2px', padding:'10px 14px', background:'#fef7e0', border:'1px solid #f9ab00', borderRadius:8, display:'flex', gap:10 }}>
              <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
              <div style={{ fontFamily:RI, fontSize:12, color:'#b05e00', lineHeight:1.5 }}>
                <strong>Scheduling conflict</strong> — another meeting overlaps this slot. Still saveable.
              </div>
            </div>
          )}

          {/* History */}
          {editing?.history?.length > 0 && (
            <div style={{ margin:'8px 0 0', padding:'12px 14px', background:'#f8f9fa', borderRadius:8, border:`1px solid ${LINE}` }}>
              <div style={{ fontFamily:RI, fontSize:11, color:INK3, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>History</div>
              {editing.history.slice(0,5).map((h,i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'6px 0', borderTop:i>0?`1px solid ${LINE}`:'none' }}>
                  <span style={{ fontFamily:RI, fontSize:11, fontWeight:600, color:INK, textTransform:'capitalize', minWidth:76, flexShrink:0 }}>{h.action}</span>
                  <div style={{ fontFamily:RI, fontSize:11, color:INK2, lineHeight:1.5 }}>
                    {h.old_date&&h.new_date&&<div>{h.old_date} → {h.new_date}</div>}
                    {h.reason&&<div style={{ fontStyle:'italic' }}>{h.reason}</div>}
                    <div style={{ color:INK3 }}>{h.changed_at?.slice(0,16).replace('T',' ')} · {h.changed_by_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:`1px solid ${LINE}`, flexShrink:0, background:'#fff' }}>
          <span style={{ fontFamily:RI, fontSize:11, color:hasConflict?'#b05e00':INK3 }}>
            {hasConflict ? '⚠️ Conflict detected' : 'Ctrl+Enter to save'}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={onClose}
              style={{ border:`1px solid ${LINE}`, borderRadius:20, padding:'8px 22px', fontSize:14, fontFamily:GS, cursor:'pointer', background:'#fff', color:BLUE, fontWeight:500 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={!canSave}
              style={{ border:'none', borderRadius:20, padding:'8px 28px', fontSize:14, fontFamily:GS, fontWeight:500, cursor:canSave?'pointer':'not-allowed', background:canSave?BLUE:'#c2d6f5', color:'#fff', transition:'background .12s', minWidth:90 }}
              onMouseEnter={e=>{ if(canSave) e.currentTarget.style.background='#1765cc'; }}
              onMouseLeave={e=>{ if(canSave) e.currentTarget.style.background=BLUE; }}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
