import { useState, useMemo, useEffect, useRef } from 'react';
import WysiwygEditor from './WysiwygEditor';
import DateField from './DateField';
import TimeField from './TimeField';

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const c = Math.max(0, Math.min(min, 23*60+59));
  return `${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`;
}
function fmtDisp(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h-12 : h === 0 ? 12 : h;
  return m === 0 ? `${hr} ${ap}` : `${hr}:${String(m).padStart(2,'0')} ${ap}`;
}
function randPart(n) {
  return Array.from({ length:n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]).join('');
}
function generateMeet() {
  return `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const GS = 'Google Sans,Roboto,sans-serif';
const RI = 'Roboto,sans-serif';

const INPUT = {
  width:'100%', border:'1px solid #dadce0', borderRadius:4,
  padding:'8px 12px', fontSize:14, fontFamily:RI, color:'#3c4043',
  background:'#fff', outline:'none', boxSizing:'border-box',
  transition:'border-color .15s',
};
const LABEL = {
  fontFamily:RI, fontSize:11, letterSpacing:'.6px', textTransform:'uppercase',
  color:'#5f6368', marginBottom:5, display:'block', fontWeight:500,
};

const RECURRENCE = [
  { v:'none',    l:'Does not repeat' },
  { v:'daily',   l:'Every day' },
  { v:'weekly',  l:'Every week' },
  { v:'monthly', l:'Every month' },
  { v:'custom',  l:'Custom...' },
];

// ── TimePicker (12h display, 15-min steps) ────────────────────────────────────
function TimePicker({ value, onChange, label }) {
  const opts = useMemo(() => {
    const list = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const t24 = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const ap  = h >= 12 ? 'PM' : 'AM';
        const hr  = h > 12 ? h-12 : h === 0 ? 12 : h;
        const lbl = `${hr}:${String(m).padStart(2,'0')} ${ap}`;
        list.push({ v:t24, l:lbl });
      }
    }
    return list;
  }, []);

  return (
    <div>
      <label style={LABEL}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...INPUT, cursor:'pointer' }}
        onFocus={e => e.target.style.borderColor='#1a73e8'}
        onBlur={e  => e.target.style.borderColor='#dadce0'}
      >
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ── Main EventModal ───────────────────────────────────────────────────────────
export default function EventModal({ initial, pairs, meetings, onSave, onClose, saving = false }) {
  const editing = initial?.meeting ?? null;
  const titleRef = useRef(null);

  const toIso = (d) => d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    : (d || '');

  const initDate  = editing?.date  || toIso(initial?.date) || '';
  const initStart = minToTime(initial?.startMin ?? (editing ? timeToMin(editing.time) : 9*60));
  const initEnd   = minToTime(initial?.endMin   ?? (editing?.end_time ? timeToMin(editing.end_time) : timeToMin(initStart)+60));

  const [title,       setTitle]       = useState(editing?.title || '');
  const [date,        setDate]        = useState(initDate);
  const [startTime,   setStartTime]   = useState(editing?.time     || initStart);
  const [endTime,     setEndTime]     = useState(editing?.end_time || initEnd);
  const [recurrence,  setRecurrence]  = useState(editing?.recurrence || 'none');
  const [mtype,       setMtype]       = useState(editing?.mtype || 'In-person');
  const [meetLink,    setMeetLink]    = useState(editing?.meet_link || '');
  const [pairId,      setPairId]      = useState(editing?.pair?.id ? String(editing.pair.id) : '');
  const [notify,      setNotify]      = useState(() => editing?.notify_units?.map(u=>u.id) || []);
  const [description, setDescription] = useState(editing?.description || '');
  const [location,    setLocation]    = useState('');

  // Auto-focus title
  useEffect(() => { titleRef.current?.focus(); }, []);

  // Auto-set notify when pair selected first time
  const selPair  = useMemo(() => pairs.find(p => p.id === parseInt(pairId)), [pairs, pairId]);
  const pairUnits= useMemo(() => selPair ? [selPair.unit_a, selPair.unit_b] : [], [selPair]);
  useEffect(() => {
    if (selPair && !editing && notify.length === 0) {
      setNotify([selPair.unit_a.id, selPair.unit_b.id]);
    }
  }, [selPair]); // eslint-disable-line

  // Auto-extend end time when start changes
  const prevStart = useRef(startTime);
  useEffect(() => {
    const prevM = timeToMin(prevStart.current);
    const curM  = timeToMin(startTime);
    const endM  = timeToMin(endTime);
    const dur   = endM - prevM;
    if (dur > 0 && dur <= 4*60) setEndTime(minToTime(curM + dur));
    prevStart.current = startTime;
  }, [startTime]); // eslint-disable-line

  // Conflict detection
  const sMin = timeToMin(startTime), eMin = timeToMin(endTime) || sMin+60;
  const hasConflict = useMemo(() => {
    if (!pairId || !date || !startTime) return false;
    return meetings
      .filter(m => m.date === date && m.id !== editing?.id && m.status !== 'cancelled')
      .some(m => { const ms = timeToMin(m.time), me = m.end_time ? timeToMin(m.end_time) : ms+60; return sMin < me && eMin > ms; });
  }, [meetings, pairId, date, sMin, eMin, editing]);

  const handleSave = () => {
    if (!pairId || !date) return;
    onSave({
      pair_id:         parseInt(pairId),
      date, title:     title.trim(),
      time:            startTime || null,
      end_time:        endTime   || null,
      description, meet_link: meetLink.trim(),
      recurrence, mtype,
      notify_unit_ids: notify.map(Number),
    }, editing?.id);
  };

  const canSave = !!pairId && !!date && !saving;

  // Keyboard save
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSave) handleSave(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [canSave, handleSave]); // eslint-disable-line

  return (
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1049 }} />

      {/* Dialog */}
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:1050, width:'min(780px, 97vw)', background:'#fff', borderRadius:8,
        boxShadow:'0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12),0 11px 15px -7px rgba(0,0,0,.2)',
        display:'flex', flexDirection:'column', maxHeight:'95vh', overflow:'hidden',
        fontFamily:GS,
      }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px 10px', borderBottom:'1px solid #e8eaed', flexShrink:0, background:'#fff' }}>
          <div style={{ fontSize:18, fontWeight:400, color:'#3c4043', fontFamily:GS }}>
            {editing ? 'Edit meeting' : 'New meeting'}
          </div>
          <button type="button" onClick={onClose}
            style={{ border:'none', background:'none', cursor:'pointer', width:34, height:34, borderRadius:'50%', fontSize:18, color:'#5f6368', display:'flex', alignItems:'center', justifyContent:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f1f3f4'}
            onMouseLeave={e=>e.currentTarget.style.background='none'}
          >✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>

          {/* ─── Left panel ─── */}
          <div style={{ flex:'0 0 55%', padding:'18px 22px', overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>

            {/* Title */}
            <div>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Add title"
                style={{ ...INPUT, fontSize:21, fontFamily:GS, fontWeight:400, border:'none', borderBottom:'2px solid #1a73e8', borderRadius:0, padding:'4px 0 8px', color:'#3c4043', background:'transparent' }}
              />
            </div>

            {/* Date picker */}
            <div>
              <label style={LABEL}>Date</label>
              <DateField value={date} onChange={setDate} />
            </div>

            {/* Time range */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'end' }}>
              <TimePicker label="Start time" value={startTime} onChange={setStartTime} />
              <div style={{ fontFamily:RI, fontSize:13, color:'#5f6368', paddingBottom:10, textAlign:'center' }}>–</div>
              <TimePicker label="End time" value={endTime} onChange={setEndTime} />
            </div>

            {/* Duration hint */}
            {startTime && endTime && (
              <div style={{ fontFamily:RI, fontSize:12, color:'#5f6368', marginTop:-10 }}>
                Duration: {(() => { const d = timeToMin(endTime)-timeToMin(startTime); if (d<=0) return '—'; const h=Math.floor(d/60), m=d%60; return h>0 ? (m>0?`${h}h ${m}m`:`${h}h`) : `${m}m`; })()}
              </div>
            )}

            {/* Recurrence */}
            <div>
              <label style={LABEL}>Repeat</label>
              <select value={recurrence} onChange={e=>setRecurrence(e.target.value)}
                style={{ ...INPUT, cursor:'pointer' }}
                onFocus={e=>e.target.style.borderColor='#1a73e8'}
                onBlur={e=>e.target.style.borderColor='#dadce0'}
              >
                {RECURRENCE.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>

            {/* Meeting type */}
            <div>
              <label style={LABEL}>Location / type</label>
              <div style={{ display:'flex', gap:6 }}>
                {[['In-person','📍 In-person'],['Online','💻 Online']].map(([v,l]) => (
                  <button key={v} type="button"
                    onClick={() => { setMtype(v); if (v==='In-person') setMeetLink(''); }}
                    style={{ flex:1, border:`1.5px solid ${mtype===v?'#1a73e8':'#dadce0'}`, borderRadius:20, padding:'7px 12px', fontSize:13, fontFamily:GS, cursor:'pointer', transition:'.13s', background: mtype===v?'#e8f0fe':'#fff', color: mtype===v?'#1a73e8':'#5f6368', fontWeight: mtype===v?500:400 }}
                  >{l}</button>
                ))}
              </div>
            </div>

            {/* Google Meet */}
            {mtype === 'Online' && (
              <div>
                <label style={LABEL}>Google Meet</label>
                {meetLink ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#e8f0fe', borderRadius:6, border:'1px solid #c5d9f1' }}>
                    <span style={{ fontSize:15 }}>📹</span>
                    <a href={meetLink} target="_blank" rel="noreferrer"
                      style={{ fontSize:12, color:'#1a73e8', wordBreak:'break-all', flex:1, fontFamily:RI }}>
                      {meetLink}
                    </a>
                    <button type="button" onClick={() => setMeetLink('')}
                      style={{ border:'none', background:'none', cursor:'pointer', fontSize:12, color:'#5f6368', flexShrink:0, fontFamily:RI }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setMeetLink(generateMeet())}
                    style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #dadce0', borderRadius:4, padding:'8px 14px', fontSize:13, fontFamily:GS, cursor:'pointer', background:'#fff', color:'#1a73e8', fontWeight:500, width:'100%', boxSizing:'border-box', transition:'background .13s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}
                  >
                    <span style={{ fontSize:18 }}>📹</span>
                    Add Google Meet video conferencing
                  </button>
                )}
              </div>
            )}

            {/* Conflict warning */}
            {hasConflict && (
              <div style={{ background:'#fef7e0', border:'1px solid #f9ab00', borderRadius:6, padding:'10px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
                <div style={{ fontFamily:RI, fontSize:12, color:'#b05e00', lineHeight:1.5 }}>
                  <strong>Scheduling conflict</strong> — another meeting overlaps this time slot. You can still save.
                </div>
              </div>
            )}
          </div>

          {/* ─── Divider ─── */}
          <div style={{ width:1, background:'#e8eaed', flexShrink:0 }} />

          {/* ─── Right panel ─── */}
          <div style={{ flex:1, padding:'18px 20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:16, background:'#fafafa' }}>

            {/* Pair selector */}
            <div>
              <label style={LABEL}>Convergence unit pair</label>
              <select value={pairId} onChange={e => { setPairId(e.target.value); setNotify([]); }}
                style={{ ...INPUT, cursor:'pointer' }}
                onFocus={e=>e.target.style.borderColor='#1a73e8'}
                onBlur={e=>e.target.style.borderColor='#dadce0'}
              >
                <option value="">— Select a pair —</option>
                {pairs.map(p => (
                  <option key={p.id} value={p.id}>{p.unit_a.name} × {p.unit_b.name}</option>
                ))}
              </select>
            </div>

            {/* Guests / notify units */}
            {pairUnits.length > 0 && (
              <div>
                <label style={LABEL}>Notify teams</label>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {pairUnits.map(u => {
                    const checked = notify.includes(u.id);
                    return (
                      <label key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', border:`1.5px solid ${checked?'#1a73e8':'#dadce0'}`, borderRadius:6, background: checked?'#e8f0fe':'#fff', cursor:'pointer', transition:'.13s' }}>
                        <input type="checkbox" checked={checked} onChange={() => setNotify(n => checked ? n.filter(x=>x!==u.id) : [...n,u.id])}
                          style={{ width:15, height:15, accentColor:'#1a73e8', flexShrink:0 }} />
                        <span style={{ width:10, height:10, borderRadius:'50%', background:u.color, flexShrink:0 }} />
                        <div>
                          <div style={{ fontFamily:GS, fontSize:13, fontWeight:500, color:'#3c4043' }}>{u.abbr}</div>
                          <div style={{ fontFamily:RI, fontSize:11, color:'#5f6368' }}>{u.name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description (WYSIWYG) */}
            <div>
              <label style={LABEL}>Description / agenda</label>
              <WysiwygEditor value={description} onChange={setDescription} placeholder="Add meeting agenda or description…" />
            </div>

            {/* History (edit mode) */}
            {editing?.history?.length > 0 && (
              <div>
                <label style={LABEL}>History</label>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {editing.history.slice(0,5).map((h, i) => (
                    <div key={i} style={{ fontFamily:RI, fontSize:11, color:'#5f6368', display:'flex', gap:8, alignItems:'flex-start', padding:'5px 0', borderTop: i>0?'1px solid #e8eaed':'none' }}>
                      <span style={{ textTransform:'capitalize', fontWeight:500, color:'#3c4043', minWidth:70, flexShrink:0 }}>{h.action}</span>
                      <div>
                        {h.old_date && h.new_date && <div>{h.old_date} → {h.new_date}</div>}
                        {h.reason && <div style={{ color:'#80868b' }}>{h.reason}</div>}
                        <div style={{ color:'#80868b' }}>{h.changed_at?.slice(0,16).replace('T',' ')} · {h.changed_by_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:'1px solid #e8eaed', flexShrink:0, background:'#fff' }}>
          <div style={{ fontFamily:RI, fontSize:11, color:'#80868b' }}>
            {hasConflict
              ? <span style={{ color:'#b05e00' }}>⚠️ Conflict detected — still saveable</span>
              : <span>Ctrl+Enter to save</span>
            }
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={onClose}
              style={{ border:'1px solid #dadce0', borderRadius:4, padding:'8px 20px', fontSize:14, fontFamily:GS, cursor:'pointer', background:'#fff', color:'#1a73e8', fontWeight:500 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
              onMouseLeave={e=>e.currentTarget.style.background='#fff'}
            >Cancel</button>
            <button type="button" onClick={handleSave} disabled={!canSave}
              style={{ border:'none', borderRadius:4, padding:'8px 22px', fontSize:14, fontFamily:GS, fontWeight:500, cursor: canSave?'pointer':'not-allowed', background: canSave?'#1a73e8':'#c2d6f5', color:'#fff', transition:'background .13s' }}
              onMouseEnter={e=>{ if(canSave) e.currentTarget.style.background='#1765cc'; }}
              onMouseLeave={e=>{ if(canSave) e.currentTarget.style.background='#1a73e8'; }}
            >{saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
