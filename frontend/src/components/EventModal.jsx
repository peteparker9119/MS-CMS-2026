import { useState, useMemo, useEffect, useRef } from 'react';
import WysiwygEditor from './WysiwygEditor';
import DateField from './DateField';

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  if (!iso) return 'Pick a date';
  const d = new Date(iso + 'T00:00:00');
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
function randPart(n) {
  return Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
}
function generateMeet() {
  return `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
}

// ── Fonts ────────────────────────────────────────────────────────────────────
const GS = 'Google Sans,Roboto,sans-serif';
const RI = 'Roboto,sans-serif';

// ── SVG Icons ────────────────────────────────────────────────────────────────
function SvgIcon({ size = 20, color = '#5f6368', children, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}>
      {children}
    </svg>
  );
}
const IcClock  = ({ color }) => <SvgIcon color={color}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></SvgIcon>;
const IcRepeat = ({ color }) => <SvgIcon color={color}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></SvgIcon>;
const IcMapPin = ({ color }) => <SvgIcon color={color}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></SvgIcon>;
const IcVideo  = ({ color }) => <SvgIcon color={color}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></SvgIcon>;
const IcUsers  = ({ color }) => <SvgIcon color={color}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></SvgIcon>;
const IcText   = ({ color }) => <SvgIcon color={color}><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></SvgIcon>;
const IcStatus = ({ color }) => <SvgIcon color={color}><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></SvgIcon>;
const IcX      = () => <SvgIcon size={18}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></SvgIcon>;

// ── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ icon, children, top = false }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '6px 0' }}>
      <div style={{ width: 20, flexShrink: 0, paddingTop: top ? 10 : 10, display: 'flex', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{children}</div>
    </div>
  );
}

// ── Time select ───────────────────────────────────────────────────────────────
const TIME_OPTS = (() => {
  const list = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) {
      const v = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const ap = h >= 12 ? 'PM' : 'AM';
      const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
      list.push({ v, l: `${hr}:${String(m).padStart(2,'0')} ${ap}` });
    }
  return list;
})();

function TimeChip({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid #dadce0', borderRadius: 20, padding: '4px 10px', fontSize: 13, fontFamily: GS, color: '#3c4043', background: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', fontWeight: 500 }}
      onFocus={e => { e.target.style.borderColor = '#1a73e8'; e.target.style.boxShadow = '0 0 0 2px rgba(26,115,232,.15)'; }}
      onBlur={e  => { e.target.style.borderColor = '#dadce0'; e.target.style.boxShadow = 'none'; }}>
      {TIME_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// ── Custom recurrence panel ───────────────────────────────────────────────────
const DOWFULL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const REPEAT_UNITS = ['day','week','month','year'];

function CustomRecurrencePanel({ value, onChange }) {
  const [every, setEvery] = useState(value?.every ?? 1);
  const [unit,  setUnit]  = useState(value?.unit  ?? 'week');
  const [days,  setDays]  = useState(value?.days  ?? []);
  const [ends,  setEnds]  = useState(value?.ends  ?? 'never');
  const [endDate,  setEndDate]  = useState(value?.endDate  ?? '');
  const [endCount, setEndCount] = useState(value?.endCount ?? 5);

  const emit = (patch) => {
    const next = { every, unit, days, ends, endDate, endCount, ...patch };
    onChange(next);
    if (patch.every !== undefined) setEvery(patch.every);
    if (patch.unit  !== undefined) setUnit(patch.unit);
    if (patch.days  !== undefined) setDays(patch.days);
    if (patch.ends  !== undefined) setEnds(patch.ends);
    if (patch.endDate  !== undefined) setEndDate(patch.endDate);
    if (patch.endCount !== undefined) setEndCount(patch.endCount);
  };

  const toggleDay = (i) => {
    const nd = days.includes(i) ? days.filter(d => d !== i) : [...days, i];
    emit({ days: nd });
  };

  const inp = (style = {}) => ({
    border: '1px solid #dadce0', borderRadius: 6, padding: '5px 8px',
    fontSize: 13, fontFamily: RI, color: '#3c4043', background: '#fff',
    outline: 'none', ...style,
  });

  return (
    <div style={{ marginTop: 10, padding: '14px 16px', background: '#f8f9fa', borderRadius: 10, border: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Every N unit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: RI, fontSize: 13, color: '#5f6368' }}>Repeat every</span>
        <input type="number" min={1} max={99} value={every}
          onChange={e => emit({ every: Math.max(1, parseInt(e.target.value) || 1) })}
          style={{ ...inp(), width: 52, textAlign: 'center' }} />
        <select value={unit} onChange={e => emit({ unit: e.target.value })}
          style={{ ...inp(), cursor: 'pointer' }}>
          {REPEAT_UNITS.map(u => (
            <option key={u} value={u}>{u}{every > 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {/* Weekday checkboxes (weekly only) */}
      {unit === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: RI, fontSize: 12, color: '#5f6368' }}>On these days</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {DOWFULL.map((d, i) => {
              const on = days.includes(i);
              return (
                <button key={d} type="button" onClick={() => toggleDay(i)}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${on ? '#1a73e8' : '#dadce0'}`, background: on ? '#1a73e8' : '#fff', color: on ? '#fff' : '#3c4043', fontFamily: GS, fontSize: 12, fontWeight: on ? 600 : 400, cursor: 'pointer', transition: 'all .13s' }}>
                  {d[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ends */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: RI, fontSize: 12, color: '#5f6368' }}>Ends</span>
        {[['never','Never'],['date','On date'],['count','After']].map(([v, l]) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="radio" name="recur-ends" value={v} checked={ends === v}
              onChange={() => emit({ ends: v })}
              style={{ accentColor: '#1a73e8', width: 15, height: 15 }} />
            <span style={{ fontFamily: RI, fontSize: 13, color: '#3c4043' }}>{l}</span>
            {v === 'date' && ends === 'date' && (
              <input type="date" value={endDate} onChange={e => emit({ endDate: e.target.value })}
                style={{ ...inp(), marginLeft: 4 }} />
            )}
            {v === 'count' && ends === 'count' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                <input type="number" min={1} max={999} value={endCount}
                  onChange={e => emit({ endCount: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ ...inp(), width: 60, textAlign: 'center' }} />
                <span style={{ fontFamily: RI, fontSize: 13, color: '#5f6368' }}>occurrence{endCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Unit card picker ──────────────────────────────────────────────────────────
function UnitCardPicker({ pairs, pairId, onPairChange, notify, onNotifyChange }) {
  // All unique units across all pairs
  const units = useMemo(() => {
    const map = {};
    pairs.forEach(p => {
      map[p.unit_a.id] = p.unit_a;
      map[p.unit_b.id] = p.unit_b;
    });
    return Object.values(map).sort((a, b) => a.abbr.localeCompare(b.abbr));
  }, [pairs]);

  // Which unit IDs are currently selected (from the current pair)
  const [selIds, setSelIds] = useState(() => {
    if (!pairId) return [];
    const p = pairs.find(p => p.id === parseInt(pairId));
    return p ? [p.unit_a.id, p.unit_b.id] : [];
  });

  const toggleUnit = (uid) => {
    let next;
    if (selIds.includes(uid)) {
      next = selIds.filter(id => id !== uid);
    } else {
      // Max 2; if already 2, replace oldest
      next = selIds.length < 2 ? [...selIds, uid] : [selIds[1], uid];
    }
    setSelIds(next);

    if (next.length === 2) {
      const [a, b] = next;
      const found = pairs.find(p =>
        (p.unit_a.id === a && p.unit_b.id === b) ||
        (p.unit_a.id === b && p.unit_b.id === a)
      );
      onPairChange(found ? String(found.id) : '', found ? [found.unit_a.id, found.unit_b.id] : next);
    } else {
      onPairChange('', next);
    }
  };

  const selPair = pairId ? pairs.find(p => p.id === parseInt(pairId)) : null;
  const noPair  = selIds.length === 2 && !pairId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: RI, fontSize: 11, color: '#80868b', textTransform: 'uppercase', letterSpacing: '.6px' }}>
        Select two units to form a convergence
      </div>

      {/* Unit cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {units.map(u => {
          const on = selIds.includes(u.id);
          const color = u.color || '#1a73e8';
          return (
            <button key={u.id} type="button" onClick={() => toggleUnit(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                border: `2px solid ${on ? color : '#dadce0'}`,
                borderRadius: 24, cursor: 'pointer', transition: 'all .13s',
                background: on ? color + '1a' : '#fff',
                boxShadow: on ? `0 0 0 3px ${color}22` : 'none',
              }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: GS, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? color : '#3c4043' }}>
                {u.abbr}
              </span>
              {u.name && u.name !== u.abbr && (
                <span style={{ fontFamily: RI, fontSize: 11, color: on ? color : '#80868b' }}>
                  {u.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Result chip */}
      {selPair && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#e8f0fe', borderRadius: 8, border: '1px solid #c5d9f1' }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <span style={{ fontFamily: GS, fontSize: 13, color: '#1a73e8', fontWeight: 500 }}>
            {selPair.unit_a.name} × {selPair.unit_b.name}
          </span>
        </div>
      )}
      {noPair && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef7e0', borderRadius: 8, border: '1px solid #f9ab00' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ fontFamily: RI, fontSize: 12, color: '#b05e00' }}>
            No convergence pair defined for these two units
          </span>
        </div>
      )}

      {/* Notify chips (only when a pair is found) */}
      {selPair && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: RI, fontSize: 11, color: '#80868b', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Notify teams
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[selPair.unit_a, selPair.unit_b].map(u => {
              const checked = notify.includes(u.id);
              return (
                <label key={u.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', border: `1.5px solid ${checked ? '#1a73e8' : '#dadce0'}`, borderRadius: 20, background: checked ? '#e8f0fe' : '#fff', cursor: 'pointer', transition: 'all .13s', userSelect: 'none' }}>
                  <input type="checkbox" checked={checked}
                    onChange={() => onNotifyChange(n => checked ? n.filter(x => x !== u.id) : [...n, u.id])}
                    style={{ width: 14, height: 14, accentColor: '#1a73e8', margin: 0 }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontFamily: GS, fontSize: 13, color: checked ? '#1a73e8' : '#3c4043', fontWeight: checked ? 500 : 400 }}>{u.abbr}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { v: 'scheduled', l: 'Scheduled', color: '#1a73e8' },
  { v: 'conducted', l: 'Conducted', color: '#0b8043' },
  { v: 'postponed', l: 'Postponed', color: '#e37400' },
  { v: 'missed',    l: 'Missed',    color: '#d93025' },
  { v: 'cancelled', l: 'Cancelled', color: '#80868b' },
];

const RECURRENCE = [
  { v: 'none',    l: 'Does not repeat' },
  { v: 'daily',   l: 'Every day' },
  { v: 'weekly',  l: 'Every week' },
  { v: 'monthly', l: 'Every month' },
  { v: 'custom',  l: 'Custom…' },
];

// ── Main EventModal ───────────────────────────────────────────────────────────
export default function EventModal({ initial, pairs, meetings, onSave, onClose, saving = false }) {
  const editing  = initial?.meeting ?? null;
  const titleRef = useRef(null);

  const toIso = (d) => d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : (d || '');

  const initDate  = editing?.date  || toIso(initial?.date) || '';
  const initStart = minToTime(initial?.startMin ?? (editing?.time ? timeToMin(editing.time) : 9 * 60));
  const initEnd   = minToTime(initial?.endMin   ?? (editing?.end_time ? timeToMin(editing.end_time) : timeToMin(initStart) + 60));

  const [title,        setTitle]       = useState(editing?.title      || '');
  const [date,         setDate]        = useState(initDate);
  const [startTime,    setStartTime]   = useState(editing?.time       || initStart);
  const [endTime,      setEndTime]     = useState(editing?.end_time   || initEnd);
  const [recurrence,   setRecurrence]  = useState(editing?.recurrence || 'none');
  const [customRec,    setCustomRec]   = useState(null);
  const [mtype,        setMtype]       = useState(editing?.mtype      || 'In-person');
  const [meetLink,     setMeetLink]    = useState(editing?.meet_link  || '');
  const [pairId,       setPairId]      = useState(editing?.pair?.id ? String(editing.pair.id) : '');
  const [notify,       setNotify]      = useState(() => editing?.notify_units?.map(u => u.id) || []);
  const [description,  setDescription] = useState(editing?.description || '');
  const [meetStatus,   setMeetStatus]  = useState(editing?.status     || 'scheduled');
  const [location,     setLocation]    = useState(editing?.location   || '');

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Auto-extend end time to preserve duration when start changes
  const prevStart = useRef(startTime);
  useEffect(() => {
    const prevM = timeToMin(prevStart.current);
    const curM  = timeToMin(startTime);
    const endM  = timeToMin(endTime);
    const dur   = endM - prevM;
    if (dur > 0 && dur <= 4 * 60) setEndTime(minToTime(curM + dur));
    prevStart.current = startTime;
  }, [startTime]); // eslint-disable-line

  // Duration string
  const durStr = useMemo(() => {
    const d = timeToMin(endTime) - timeToMin(startTime);
    if (d <= 0) return null;
    const h = Math.floor(d / 60), m = d % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }, [startTime, endTime]);

  // Conflict detection
  const sMin = timeToMin(startTime), eMin = timeToMin(endTime) || sMin + 60;
  const hasConflict = useMemo(() => {
    if (!pairId || !date || !startTime) return false;
    return meetings
      .filter(m => m.date === date && m.id !== editing?.id && m.status !== 'cancelled')
      .some(m => {
        const ms = timeToMin(m.time), me = m.end_time ? timeToMin(m.end_time) : ms + 60;
        return sMin < me && eMin > ms;
      });
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
      recurrence:      recurrence === 'custom' ? JSON.stringify(customRec) : recurrence,
      mtype,
      location:        location.trim(),
      notify_unit_ids: notify.map(Number),
    };
    if (editing) payload.status = meetStatus;
    onSave(payload, editing?.id);
  };

  const canSave = !!pairId && !!date && !saving;

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSave) handleSave(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [canSave]); // eslint-disable-line

  const statusColor = STATUS_OPTIONS.find(s => s.v === meetStatus)?.color || '#1a73e8';

  // Recurrence summary label
  const recLabel = recurrence === 'custom' && customRec
    ? `Every ${customRec.every} ${customRec.unit}${customRec.every > 1 ? 's' : ''}`
    : RECURRENCE.find(r => r.v === recurrence)?.l ?? 'Does not repeat';

  return (
    <>
      {/* No dark backdrop — GCal style: modal floats without overlay */}

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1050,
        width: 'min(580px, 97vw)',
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(60,64,67,.28), 0 2px 8px rgba(60,64,67,.18)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh',
        overflow: 'hidden',
        fontFamily: GS,
      }}>

        {/* ── Top color bar ── */}
        <div style={{ height: 6, background: editing ? statusColor : '#1a73e8', flexShrink: 0, borderRadius: '14px 14px 0 0' }} />

        {/* ── Title row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px 8px', flexShrink: 0 }}>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add title"
            style={{
              flex: 1, border: 'none', borderBottom: '2px solid #e8eaed',
              borderRadius: 0, padding: '4px 0 10px',
              fontSize: 22, fontFamily: GS, fontWeight: 400, color: '#3c4043',
              background: 'transparent', outline: 'none', minWidth: 0,
              transition: 'border-color .15s',
            }}
            onFocus={e => e.target.style.borderBottomColor = '#1a73e8'}
            onBlur={e  => e.target.style.borderBottomColor = '#e8eaed'}
          />
          <button type="button" onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368', flexShrink: 0, marginTop: 2 }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <IcX />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ── SANDWICH: date · start – end (duration) ── */}
          <FieldRow icon={<IcClock />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* One-line sandwich row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Date pill (opens DateField popup) */}
                <DateField
                  value={date}
                  onChange={setDate}
                  placeholder="Pick a date"
                  style={{ width: 'auto', display: 'inline-block' }}
                />

                {/* Separator */}
                <span style={{ fontFamily: RI, fontSize: 14, color: '#bdc1c6' }}>·</span>

                {/* Time chips */}
                <TimeChip value={startTime} onChange={setStartTime} />
                <span style={{ fontFamily: RI, fontSize: 14, color: '#5f6368', flexShrink: 0 }}>–</span>
                <TimeChip value={endTime} onChange={setEndTime} />

                {durStr && (
                  <span style={{ fontFamily: RI, fontSize: 12, color: '#80868b', flexShrink: 0, background: '#f1f3f4', borderRadius: 10, padding: '2px 8px' }}>
                    {durStr}
                  </span>
                )}
              </div>

              {/* Recurrence row — compact text link style */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: RI, fontSize: 12, color: '#80868b' }}>
                  {Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'Local time'}
                </span>
                <span style={{ color: '#dadce0' }}>·</span>
                <select value={recurrence} onChange={e => setRecurrence(e.target.value)}
                  style={{ border: 'none', background: 'none', fontFamily: RI, fontSize: 12, color: '#5f6368', cursor: 'pointer', outline: 'none', padding: 0 }}>
                  {RECURRENCE.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>

              {/* Custom recurrence panel */}
              {recurrence === 'custom' && (
                <CustomRecurrencePanel value={customRec} onChange={setCustomRec} />
              )}
            </div>
          </FieldRow>

          {/* ── Location / Meeting type ── */}
          <FieldRow icon={mtype === 'Online' ? <IcVideo /> : <IcMapPin />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['In-person', '📍'], ['Online', '💻']].map(([v, icon]) => (
                  <button key={v} type="button"
                    onClick={() => { setMtype(v); if (v === 'In-person') setMeetLink(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      border: `1.5px solid ${mtype === v ? '#1a73e8' : '#dadce0'}`,
                      borderRadius: 20, padding: '6px 14px', fontSize: 13, fontFamily: GS,
                      cursor: 'pointer', transition: 'all .13s',
                      background: mtype === v ? '#e8f0fe' : '#fff',
                      color: mtype === v ? '#1a73e8' : '#5f6368',
                      fontWeight: mtype === v ? 500 : 400,
                    }}>
                    <span>{icon}</span>{v}
                  </button>
                ))}
              </div>

              {mtype === 'In-person' && (
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="Add location (optional)"
                  style={{ width: '100%', border: '1px solid #dadce0', borderRadius: 4, padding: '7px 10px', fontSize: 13, fontFamily: RI, color: '#3c4043', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = '#1a73e8'; e.target.style.boxShadow = '0 0 0 2px rgba(26,115,232,.2)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#dadce0'; e.target.style.boxShadow = 'none'; }} />
              )}

              {mtype === 'Online' && (
                meetLink ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#e8f0fe', borderRadius: 6, border: '1px solid #c5d9f1' }}>
                    <span style={{ fontSize: 16 }}>📹</span>
                    <a href={meetLink} target="_blank" rel="noreferrer"
                      style={{ flex: 1, fontSize: 12, color: '#1a73e8', wordBreak: 'break-all', fontFamily: RI, textDecoration: 'none' }}>
                      {meetLink}
                    </a>
                    <button type="button" onClick={() => setMeetLink('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#5f6368', flexShrink: 0, fontFamily: RI, padding: '2px 6px', borderRadius: 4 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#c5d9f1'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setMeetLink(generateMeet())}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #dadce0', borderRadius: 4, padding: '9px 14px', fontSize: 13, fontFamily: GS, cursor: 'pointer', background: '#fff', color: '#1a73e8', fontWeight: 500, width: '100%', boxSizing: 'border-box', transition: 'background .13s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <span style={{ fontSize: 18 }}>📹</span>
                    Add Google Meet video conferencing
                  </button>
                )
              )}
            </div>
          </FieldRow>

          {/* ── Convergence unit card picker ── */}
          <FieldRow icon={<IcUsers />}>
            <UnitCardPicker
              pairs={pairs}
              pairId={pairId}
              onPairChange={(newPairId, _unitIds) => {
                setPairId(newPairId);
                if (newPairId) {
                  const p = pairs.find(p => p.id === parseInt(newPairId));
                  if (p) setNotify([p.unit_a.id, p.unit_b.id]);
                } else {
                  setNotify([]);
                }
              }}
              notify={notify}
              onNotifyChange={setNotify}
            />
          </FieldRow>

          {/* ── Status pills (edit mode only) ── */}
          {editing && (
            <FieldRow icon={<IcStatus color={statusColor} />}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s.v} type="button" onClick={() => setMeetStatus(s.v)}
                    style={{
                      border: `1.5px solid ${meetStatus === s.v ? s.color : '#dadce0'}`,
                      borderRadius: 20, padding: '5px 12px', fontSize: 12, fontFamily: GS,
                      cursor: 'pointer', transition: 'all .13s',
                      background: meetStatus === s.v ? s.color + '18' : '#fff',
                      color: meetStatus === s.v ? s.color : '#5f6368',
                      fontWeight: meetStatus === s.v ? 600 : 400,
                    }}>
                    {s.l}
                  </button>
                ))}
              </div>
            </FieldRow>
          )}

          {/* ── Description ── */}
          <FieldRow icon={<IcText />} top>
            <WysiwygEditor
              value={description}
              onChange={setDescription}
              placeholder="Add meeting agenda or description…"
            />
          </FieldRow>

          {/* ── Conflict warning ── */}
          {hasConflict && (
            <div style={{ margin: '6px 0 2px', padding: '10px 14px', background: '#fef7e0', border: '1px solid #f9ab00', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
              <div style={{ fontFamily: RI, fontSize: 12, color: '#b05e00', lineHeight: 1.5 }}>
                <strong>Scheduling conflict</strong> — another meeting overlaps this slot. You can still save.
              </div>
            </div>
          )}

          {/* ── History (edit mode) ── */}
          {editing?.history?.length > 0 && (
            <div style={{ margin: '8px 0 0', padding: '12px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #e8eaed' }}>
              <div style={{ fontFamily: RI, fontSize: 11, color: '#80868b', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                History
              </div>
              {editing.history.slice(0, 5).map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i > 0 ? '1px solid #e8eaed' : 'none' }}>
                  <span style={{ fontFamily: RI, fontSize: 11, fontWeight: 600, color: '#3c4043', textTransform: 'capitalize', minWidth: 76, flexShrink: 0 }}>{h.action}</span>
                  <div style={{ fontFamily: RI, fontSize: 11, color: '#5f6368', lineHeight: 1.5 }}>
                    {h.old_date && h.new_date && <div>{h.old_date} → {h.new_date}</div>}
                    {h.reason && <div style={{ fontStyle: 'italic' }}>{h.reason}</div>}
                    <div style={{ color: '#80868b' }}>{h.changed_at?.slice(0, 16).replace('T', ' ')} · {h.changed_by_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #e8eaed', flexShrink: 0, background: '#fff' }}>
          <span style={{ fontFamily: RI, fontSize: 11, color: hasConflict ? '#b05e00' : '#80868b' }}>
            {hasConflict ? '⚠️ Conflict — still saveable' : 'Ctrl+Enter to save'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}
              style={{ border: '1px solid #dadce0', borderRadius: 20, padding: '8px 22px', fontSize: 14, fontFamily: GS, cursor: 'pointer', background: '#fff', color: '#1a73e8', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={!canSave}
              style={{ border: 'none', borderRadius: 20, padding: '8px 24px', fontSize: 14, fontFamily: GS, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? '#1a73e8' : '#c2d6f5', color: '#fff', transition: 'background .13s', minWidth: 80 }}
              onMouseEnter={e => { if (canSave) e.currentTarget.style.background = '#1765cc'; }}
              onMouseLeave={e => { if (canSave) e.currentTarget.style.background = '#1a73e8'; }}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
