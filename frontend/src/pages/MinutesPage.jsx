import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings, createMeeting, submitMinutes, recordNotHeld } from '../api/meetings';
import { getUnits, getPairs } from '../api/units';
import { getUsersByUnits } from '../api/items';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import DateField from '../components/DateField';
import Badge from '../components/Badge';
import { downloadPDF, downloadWord } from '../utils/momExport';
import { CCard, CCardBody, CRow, CCol } from '@coreui/react';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_COLOR = { conducted:'#1D9E75', scheduled:'#378ADD', postponed:'#E0A21C', missed:'#D85A30', cancelled:'#9ca3af' };

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayISO() { return toISO(new Date()); }
function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hr} ${ap}` : `${hr}:${String(m).padStart(2,'0')} ${ap}`;
}

// Can MoM be entered: only if conducted, OR scheduled AND today AND >= start time
function canEnterMoM(m) {
  if (m.status === 'conducted') return true;
  if (m.status !== 'scheduled') return false;
  if (m.date !== todayISO()) return false;
  if (!m.time) return true;
  const [hh, mm] = m.time.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
}

// ── Share / export helpers (kept from original) ───────────────────────────────
function formatMoM(meeting) {
  const m = meeting, mins = m.minutes;
  const A = m.pair.unit_a, B = m.pair.unit_b;
  const lines = [
    '📋 MINUTES OF MEETING',
    '══════════════════════════════',
    `Meeting : ${A.name} × ${B.name}`,
    `Date    : ${m.date}${m.time ? ', ' + m.time : ''}`,
    `Type    : ${m.mtype || 'In-person'}`,
  ];
  if (mins?.attendees) lines.push(`Attended: ${mins.attendees}`);
  if (m.agenda)        lines.push('', '📌 AGENDA', m.agenda);
  if (mins?.summary)   lines.push('', '📝 SUMMARY', mins.summary);
  if (mins?.action_points?.length) {
    lines.push('', '✅ ACTION POINTS');
    mins.action_points.forEach(ap => lines.push(`${ap.done?'☑':'☐'} ${ap.aid}: ${ap.text}`));
  }
  lines.push('', '──────────────────────────────', 'MS - CMS Convergence — TN EMIS');
  return lines.join('\n');
}
function shareWhatsApp(meeting) {
  window.open('https://wa.me/?text=' + encodeURIComponent(formatMoM(meeting)), '_blank');
}

// ── RecordModal (unchanged from before) ──────────────────────────────────────
function RecordModal({ pairs, meetings, formPairs, pocUnit, pairMembers, onClose, onSubmit, saving }) {
  const [selPair,     setSelPair]     = useState('');
  const [mDate,       setMDate]       = useState('');
  const [outcome,     setOutcome]     = useState('held');
  const [attendees,   setAttendees]   = useState('');
  const [summary,     setSummary]     = useState('');
  const [actionItems, setActionItems] = useState([{ text:'', assigned_to:null, deadline:'' }]);
  const [nhStatus,    setNhStatus]    = useState('postponed');
  const [reason,      setReason]      = useState('');
  const [fe,          setFe]          = useState({});

  const clearFe = f => setFe(p => ({ ...p, [f]:'' }));
  const addAP    = () => setActionItems(p => [...p, { text:'', assigned_to:null, deadline:'' }]);
  const removeAP = i  => setActionItems(p => p.filter((_,idx) => idx!==i));
  const updateAP = (i,f,v) => setActionItems(p => p.map((it,idx) => idx===i ? {...it,[f]:v} : it));

  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const LBL = { fontFamily:'var(--fm)', fontSize:12, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 };
  const INP = { border:'1px solid var(--line)', borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'var(--fm)', color:'var(--ink)', width:'100%', boxSizing:'border-box', outline:'none', background:'#fff' };

  const handleSubmit = () => {
    const errors = {};
    if (!selPair) errors.selPair = 'Select a convergence unit pair';
    if (!mDate)   errors.mDate   = 'Pick a meeting date';
    const apItems = outcome === 'held'
      ? actionItems.filter(a => a.text.trim()).map(a => ({ text:a.text.trim(), assigned_to:a.assigned_to||null, deadline:a.deadline||null }))
      : [];
    if (outcome==='held' && !summary && !apItems.length) errors.summary = 'Add a summary or at least one action point';
    if (outcome==='notheld' && !reason) errors.reason = 'Provide a reason';
    if (Object.keys(errors).length) { setFe(errors); return; }
    setFe({});
    onSubmit({ selPair, mDate, outcome, attendees, summary, apItems, nhStatus, reason });
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1100 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1101, width:'min(760px,96vw)', maxHeight:'92vh', background:'#fff', borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,.28)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--fm)' }}>
        <div style={{ padding:'20px 28px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:22, color:'var(--ink)' }}>Record meeting</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)', marginTop:3 }}>held → file minutes · not held → record reason</div>
          </div>
          <button type="button" onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', width:38, height:38, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink2)', fontSize:22, lineHeight:1 }} onMouseEnter={e=>e.currentTarget.style.background='#f1f3f4'} onMouseLeave={e=>e.currentTarget.style.background='none'}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div>
              <label style={LBL}>Convergence unit pair</label>
              <select value={selPair} onChange={e => { setSelPair(e.target.value); clearFe('selPair'); }} style={{ ...INP, cursor:'pointer' }} onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'}>
                <option value="">— Select pair —</option>
                {formPairs.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {pocUnit ? (p.unit_a.slug===pocUnit.slug ? p.unit_b.name : p.unit_a.name) : `${p.unit_a.abbr} × ${p.unit_b.abbr}`}
                  </option>
                ))}
              </select>
              {fe.selPair && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.selPair}</div>}
            </div>
            <div>
              <label style={LBL}>Meeting date</label>
              <DateField value={mDate} onChange={v => { setMDate(v); clearFe('mDate'); }} />
              {fe.mDate && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.mDate}</div>}
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={LBL}>Outcome</label>
            <div style={{ display:'flex', gap:10 }}>
              {[['held','✅ Meeting held'],['notheld','⚠ Not held']].map(([v,l]) => (
                <label key={v} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, height:44, border:`1.5px solid ${outcome===v?'var(--accent)':'var(--line)'}`, borderRadius:10, fontSize:14, cursor:'pointer', background:outcome===v?'var(--accent-light)':'#fff', fontWeight:outcome===v?700:500, color:outcome===v?'var(--accent)':'var(--ink2)', transition:'.13s' }}>
                  <input type="radio" style={{ display:'none' }} checked={outcome===v} onChange={() => setOutcome(v)} />{l}
                </label>
              ))}
            </div>
          </div>
          {outcome === 'held' ? (
            <>
              <div style={{ marginBottom:20 }}>
                <label style={LBL}>Attendees present</label>
                <input style={INP} value={attendees} onChange={e=>setAttendees(e.target.value)} placeholder="e.g. 6 of 8 members" onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={LBL}>Summary / discussion</label>
                <textarea style={{ ...INP, resize:'vertical', minHeight:100, lineHeight:1.6 }} value={summary} onChange={e=>{ setSummary(e.target.value); clearFe('summary'); }} placeholder="What was discussed and decided…" onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
                {fe.summary && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.summary}</div>}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ ...LBL, margin:0 }}>Action points</label>
                  <button type="button" onClick={addAP} style={{ border:'1.5px solid var(--accent)', borderRadius:8, padding:'5px 14px', background:'var(--accent-light)', color:'var(--accent)', fontFamily:'var(--fb)', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Add item</button>
                </div>
                {actionItems.map((item,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 180px 140px 34px', gap:8, marginBottom:10, alignItems:'start' }}>
                    <input style={{ ...INP, fontSize:14 }} value={item.text} onChange={e=>updateAP(i,'text',e.target.value)} placeholder={`Action item ${i+1}…`} onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
                    <select style={{ ...INP, cursor:'pointer', fontSize:13 }} value={item.assigned_to??''} onChange={e=>updateAP(i,'assigned_to',e.target.value?Number(e.target.value):null)}>
                      <option value="">— Assign to —</option>
                      {pairMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit_abbr})</option>)}
                    </select>
                    <input type="date" value={item.deadline} onChange={e=>updateAP(i,'deadline',e.target.value)} style={{ ...INP, fontSize:13, cursor:'pointer' }} />
                    {actionItems.length > 1 ? <button type="button" onClick={()=>removeAP(i)} style={{ height:42, width:34, border:'1px solid #fca5a5', borderRadius:8, background:'#fff5f5', color:'#dc2626', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button> : <span />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom:20 }}>
                <label style={LBL}>What happened</label>
                <div style={{ display:'flex', gap:10 }}>
                  {[['postponed','🕘 Postponed'],['missed','✕ Missed']].map(([v,l]) => (
                    <label key={v} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, height:44, border:`1.5px solid ${nhStatus===v?'#f59e0b':'var(--line)'}`, borderRadius:10, fontSize:14, cursor:'pointer', background:nhStatus===v?'#fef9ec':'#fff', fontWeight:nhStatus===v?700:500, color:nhStatus===v?'#92600a':'var(--ink2)', transition:'.13s' }}>
                      <input type="radio" style={{ display:'none' }} checked={nhStatus===v} onChange={()=>setNhStatus(v)} />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={LBL}>Reason — why it didn't happen</label>
                <textarea style={{ ...INP, resize:'vertical', minHeight:100, lineHeight:1.6 }} value={reason} onChange={e=>{ setReason(e.target.value); clearFe('reason'); }} placeholder="e.g. Key members on field duty…" onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
                {fe.reason && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.reason}</div>}
              </div>
            </>
          )}
        </div>
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0, background:'#fff' }}>
          <button type="button" onClick={onClose} style={{ border:'1px solid var(--line)', borderRadius:20, padding:'10px 24px', fontSize:14, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--accent)', fontWeight:500 }} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={{ border:'none', borderRadius:20, padding:'10px 32px', fontSize:14, fontFamily:'var(--fb)', fontWeight:600, cursor:saving?'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:saving?.7:1 }}>
            {saving ? 'Saving…' : outcome==='held' ? 'Submit minutes' : 'Record reason'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Action point row — cascading reveal ───────────────────────────────────────
function ActionPointRow({ ap, index, unitA, unitB, usersByUnit, onUpdate, onRemove, showRemove }) {
  const INP = { border:'1px solid var(--line)', borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'var(--fm)', color:'var(--ink)', width:'100%', boxSizing:'border-box', outline:'none', background:'#fff' };

  const showUnit     = ap.text.trim().length > 0;
  const showUser     = showUnit && ap.unitId !== null;
  const showDeadline = showUser && ap.userId !== null;
  const users        = usersByUnit[ap.unitId] ?? [];

  return (
    <div style={{ border:'1px solid var(--line)', borderRadius:12, padding:'14px 16px', marginBottom:12, background:'#fafbfc', display:'flex', flexDirection:'column', gap:12 }}>
      {/* Row header */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:700, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:'.04em', minWidth:24 }}>{index + 1}</span>
        <input
          style={{ ...INP, flex:1, fontSize:15 }}
          value={ap.text}
          onChange={e => onUpdate(index, 'text', e.target.value)}
          placeholder="What needs to be done…"
          onFocus={e => e.target.style.borderColor='var(--accent)'}
          onBlur={e  => e.target.style.borderColor='var(--line)'}
        />
        {showRemove && (
          <button type="button" onClick={() => onRemove(index)}
            style={{ border:'1px solid #fca5a5', borderRadius:8, background:'#fff5f5', color:'#dc2626', width:34, height:38, fontSize:18, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ×
          </button>
        )}
      </div>

      {/* Step 2 — Assign to which unit */}
      {showUnit && (
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:34 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>Assign to</span>
          <div style={{ display:'flex', gap:8 }}>
            {[unitA, unitB].map(unit => {
              const on = ap.unitId === unit.id;
              return (
                <button key={unit.id} type="button"
                  onClick={() => onUpdate(index, 'unitId', on ? null : unit.id)}
                  style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 16px', border:`1.5px solid ${on ? unit.color : 'var(--line)'}`, borderRadius:20, cursor:'pointer', background: on ? unit.color : '#fff', color: on ? '#fff' : 'var(--ink)', fontFamily:'var(--fb)', fontSize:13, fontWeight:on?700:500, transition:'all .12s' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background: on ? 'rgba(255,255,255,.7)' : unit.color, flexShrink:0 }} />
                  {unit.abbr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — Pick user from selected unit */}
      {showUser && (
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:34 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>Person</span>
          <select
            value={ap.userId ?? ''}
            onChange={e => onUpdate(index, 'userId', e.target.value ? Number(e.target.value) : null)}
            style={{ ...INP, flex:1, maxWidth:320, fontSize:13, cursor:'pointer' }}
            onFocus={e => e.target.style.borderColor='var(--accent)'}
            onBlur={e  => e.target.style.borderColor='var(--line)'}
          >
            <option value="">— Select person —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {/* Step 4 — Deadline */}
      {showDeadline && (
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:34 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>Deadline</span>
          <DateField
            value={ap.deadline}
            onChange={v => onUpdate(index, 'deadline', v)}
            placeholder="Pick a deadline"
            style={{ display:'inline-block' }}
          />
        </div>
      )}
    </div>
  );
}

// ── MoM Entry Modal ───────────────────────────────────────────────────────────
function MomEntryModal({ meeting, onClose, onSave, saving }) {
  const unitA = meeting.pair.unit_a;
  const unitB = meeting.pair.unit_b;

  const { data: unitAUsers = [] } = useQuery({
    queryKey: ['users-by-unit', unitA.id],
    queryFn:  () => getUsersByUnits([unitA.id]),
    staleTime: 5 * 60 * 1000,
  });
  const { data: unitBUsers = [] } = useQuery({
    queryKey: ['users-by-unit', unitB.id],
    queryFn:  () => getUsersByUnits([unitB.id]),
    staleTime: 5 * 60 * 1000,
  });
  const usersByUnit = { [unitA.id]: unitAUsers, [unitB.id]: unitBUsers };

  const existingMins = meeting.minutes;
  const [summary,   setSummary]   = useState(existingMins?.summary   ?? '');
  const [attendees, setAttendees] = useState(existingMins?.attendees ?? '');
  const [aps, setAps] = useState(() => {
    if (existingMins?.action_points?.length) {
      return existingMins.action_points.map(ap => ({
        id:       ap.id ?? null,
        text:     ap.text ?? '',
        unitId:   ap.responsible_unit ?? null,
        userId:   ap.assigned_to ?? null,
        deadline: ap.deadline ?? '',
      }));
    }
    return [{ id:null, text:'', unitId:null, userId:null, deadline:'' }];
  });
  const [fe, setFe] = useState({});

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const addAP = () => setAps(p => [...p, { id:null, text:'', unitId:null, userId:null, deadline:'' }]);

  const updateAP = (i, field, value) => setAps(prev => prev.map((ap, idx) => {
    if (idx !== i) return ap;
    const u = { ...ap, [field]: value };
    if (field === 'text')   { u.unitId = null; u.userId = null; u.deadline = ''; }
    if (field === 'unitId') { u.userId = null; u.deadline = ''; }
    if (field === 'userId') { u.deadline = ''; }
    return u;
  }));

  const removeAP = i => setAps(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const cleanAps = aps.filter(ap => ap.text.trim()).map(ap => ({
      text:     ap.text.trim(),
      responsible_unit: ap.unitId ?? null,
      assigned_to:      ap.userId ?? null,
      deadline:         ap.deadline || null,
    }));
    if (!summary.trim() && !cleanAps.length) {
      setFe({ summary: 'Add a summary or at least one action point' });
      return;
    }
    setFe({});
    onSave({ attendees, summary, action_points: cleanAps, source: 'written' });
  };

  const INP = { border:'1px solid var(--line)', borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'var(--fm)', color:'var(--ink)', width:'100%', boxSizing:'border-box', outline:'none', background:'#fff' };
  const LBL = { fontFamily:'var(--fm)', fontSize:12, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:8 };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1100 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1101, width:'min(800px,96vw)', maxHeight:'92vh', background:'#fff', borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,.3)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--fm)' }}>

        {/* Header */}
        <div style={{ padding:'20px 28px 16px', borderBottom:'1px solid var(--line)', flexShrink:0, background: `linear-gradient(135deg, ${unitA.color}18 0%, ${unitB.color}18 100%)` }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ width:12, height:12, borderRadius:'50%', background:unitA.color, display:'inline-block', flexShrink:0 }} />
                <span style={{ fontFamily:'var(--fd)', fontSize:20, fontWeight:700, color:'var(--ink)' }}>{unitA.abbr} × {unitB.abbr}</span>
                <span style={{ width:12, height:12, borderRadius:'50%', background:unitB.color, display:'inline-block', flexShrink:0 }} />
                <Badge status={meeting.status} />
              </div>
              <div style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)', display:'flex', gap:16, flexWrap:'wrap' }}>
                <span>📅 {meeting.date}</span>
                {meeting.time && <span>🕐 {fmtTime(meeting.time)}{meeting.end_time ? ` – ${fmtTime(meeting.end_time)}` : ''}</span>}
                <span style={{ fontStyle:'italic' }}>{unitA.name} × {unitB.name}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ border:'none', background:'rgba(0,0,0,.07)', cursor:'pointer', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink2)', fontSize:20, lineHeight:1, flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,.13)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.07)'}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

          {/* Attendees */}
          <div style={{ marginBottom:20 }}>
            <label style={LBL}>Attendees present</label>
            <input style={INP} value={attendees} onChange={e=>setAttendees(e.target.value)} placeholder="e.g. 6 of 8 members" onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
          </div>

          {/* Summary */}
          <div style={{ marginBottom:24 }}>
            <label style={LBL}>Minutes / Summary</label>
            <textarea
              style={{ ...INP, resize:'vertical', minHeight:130, lineHeight:1.7, fontSize:15 }}
              value={summary}
              onChange={e => { setSummary(e.target.value); setFe({}); }}
              placeholder="Record what was discussed, decisions made, and outcomes of the meeting…"
              onFocus={e=>e.target.style.borderColor='var(--accent)'}
              onBlur={e =>e.target.style.borderColor='var(--line)'}
            />
            {fe.summary && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.summary}</div>}
          </div>

          {/* Action Points */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <label style={{ ...LBL, margin:0 }}>Action Points</label>
              <button type="button" onClick={addAP}
                style={{ border:'1.5px solid var(--accent)', borderRadius:20, padding:'6px 18px', background:'var(--accent-light)', color:'var(--accent)', fontFamily:'var(--fb)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                + Add action point
              </button>
            </div>
            {aps.map((ap, i) => (
              <ActionPointRow
                key={i}
                ap={ap}
                index={i}
                unitA={unitA}
                unitB={unitB}
                usersByUnit={usersByUnit}
                onUpdate={updateAP}
                onRemove={removeAP}
                showRemove={aps.length > 1}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, background:'#fff' }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)' }}>Ctrl+Enter to save</span>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onClose} style={{ border:'1px solid var(--line)', borderRadius:20, padding:'10px 24px', fontSize:14, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--accent)', fontWeight:500 }} onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ border:'none', borderRadius:20, padding:'10px 32px', fontSize:14, fontFamily:'var(--fb)', fontWeight:600, cursor:saving?'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:saving?.7:1 }}>
              {saving ? 'Saving…' : existingMins ? 'Update MoM' : 'Save MoM'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Meeting row ───────────────────────────────────────────────────────────────
function MeetingRow({ meeting, onEnterMoM }) {
  const [tip, setTip] = useState(false);
  const A = meeting.pair?.unit_a, B = meeting.pair?.unit_b;
  const d = new Date(meeting.date + 'T00:00:00');
  const allowed = canEnterMoM(meeting);
  const hasMoM  = !!meeting.minutes;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 18px', border:'1px solid var(--line)', borderRadius:12, background:'#fff', transition:'box-shadow .15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>

      {/* Date badge */}
      <div style={{ flexShrink:0, width:48, textAlign:'center', background:'var(--paper)', border:'1px solid var(--line)', borderRadius:10, padding:'6px 0' }}>
        <div style={{ fontFamily:'var(--fm)', fontSize:10, textTransform:'uppercase', color:'var(--ink3)', letterSpacing:'.5px', fontWeight:600 }}>{MONTHS_S[d.getMonth()]}</div>
        <div style={{ fontFamily:'var(--fd)', fontSize:22, fontWeight:700, color:'var(--ink)', lineHeight:1.1 }}>{d.getDate()}</div>
      </div>

      {/* Pair info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          {A && <span style={{ width:9, height:9, borderRadius:'50%', background:A.color, display:'inline-block', flexShrink:0 }} />}
          <span style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:16, color:'var(--ink)' }}>{A?.abbr} × {B?.abbr}</span>
          {B && <span style={{ width:9, height:9, borderRadius:'50%', background:B.color, display:'inline-block', flexShrink:0 }} />}
          <Badge status={meeting.status} />
        </div>
        <div style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', display:'flex', gap:12 }}>
          <span>{A?.name} × {B?.name}</span>
          {meeting.time && <span>🕐 {fmtTime(meeting.time)}{meeting.end_time ? ` – ${fmtTime(meeting.end_time)}` : ''}</span>}
          {hasMoM && <span style={{ color:'#1D9E75', fontWeight:600 }}>✅ MoM filed</span>}
        </div>
      </div>

      {/* Action button */}
      <div style={{ flexShrink:0, position:'relative' }}
        onMouseEnter={() => { if (!allowed) setTip(true); }}
        onMouseLeave={() => setTip(false)}>
        <button type="button"
          onClick={() => allowed && onEnterMoM(meeting)}
          disabled={!allowed}
          style={{
            border:'none', borderRadius:20, padding:'8px 20px', fontSize:13,
            fontFamily:'var(--fb)', fontWeight:600,
            cursor: allowed ? 'pointer' : 'not-allowed',
            background: allowed ? 'var(--accent)' : 'var(--paper)',
            color: allowed ? '#fff' : 'var(--ink3)',
            opacity: allowed ? 1 : 0.6,
            transition:'background .12s',
            whiteSpace:'nowrap',
          }}
          onMouseEnter={e => { if (allowed) e.currentTarget.style.background='#1557b0'; }}
          onMouseLeave={e => { if (allowed) e.currentTarget.style.background='var(--accent)'; }}
        >
          {hasMoM ? 'View / Edit MoM' : 'Enter MoM'}
        </button>
        {tip && (
          <div style={{ position:'absolute', bottom:'calc(100% + 8px)', right:0, background:'#3c4043', color:'#fff', borderRadius:8, padding:'7px 12px', fontSize:12, fontFamily:'var(--fm)', whiteSpace:'nowrap', zIndex:10, boxShadow:'0 4px 12px rgba(0,0,0,.2)', pointerEvents:'none' }}>
            {meeting.status === 'scheduled' && meeting.date !== todayISO()
              ? `MoM can only be entered on the meeting day (${meeting.date})`
              : meeting.status === 'scheduled'
              ? 'MoM can be entered once the meeting starts'
              : `Cannot enter MoM for ${meeting.status} meetings`}
            <div style={{ position:'absolute', bottom:-5, right:20, width:10, height:10, background:'#3c4043', transform:'rotate(45deg)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MinutesPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();

  const { data: units = [] } = useQuery({ queryKey:['units'], queryFn: getUnits });
  const { data: pairs = [] } = useQuery({ queryKey:['pairs'], queryFn: getPairs });

  const [curPOC, setCurPOC] = useState(user?.unit_slug ?? '');
  const pocUnit = units.find(u => u.slug === (user?.role === 'poc' ? user.unit_slug : curPOC));

  const pocPairs  = useMemo(() => pairs.filter(p => p.unit_a.slug===pocUnit?.slug||p.unit_b.slug===pocUnit?.slug), [pairs, pocUnit]);
  const formPairs = useMemo(() => pocUnit ? pocPairs : (user?.role==='admin' ? pairs : []), [pocUnit, pocPairs, pairs, user]);

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', pocUnit?.slug],
    queryFn:  () => getMeetings({ unit: pocUnit?.slug }),
    enabled:  true,
  });

  // ── Filtering state ──────────────────────────────────────────────────────────
  const now = new Date();
  const initMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [selMonth, setSelMonth] = useState(initMonth);
  const [activeTab, setActiveTab] = useState('all');

  // Month strip: 3 behind, current, 2 ahead
  const monthPills = useMemo(() => {
    const meetingCounts = {};
    meetings.forEach(m => {
      if (!m.date) return;
      const k = m.date.slice(0,7);
      meetingCounts[k] = (meetingCounts[k]??0) + 1;
    });
    return Array.from({ length: 6 }, (_,i) => {
      const d = new Date(now.getFullYear(), now.getMonth()-3+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return { key, label:`${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`, count: meetingCounts[key]??0 };
    });
  }, [meetings]); // eslint-disable-line

  const monthMeetings = useMemo(() => meetings.filter(m => m.date?.startsWith(selMonth)), [meetings, selMonth]);

  const tabCounts = useMemo(() => ({
    all:       monthMeetings.length,
    upcoming:  monthMeetings.filter(m => m.status==='scheduled').length,
    conducted: monthMeetings.filter(m => m.status==='conducted').length,
    notheld:   monthMeetings.filter(m => ['missed','postponed','cancelled'].includes(m.status)).length,
  }), [monthMeetings]);

  const visible = useMemo(() => {
    let list = monthMeetings;
    if (activeTab==='upcoming')  list = list.filter(m => m.status==='scheduled');
    if (activeTab==='conducted') list = list.filter(m => m.status==='conducted');
    if (activeTab==='notheld')   list = list.filter(m => ['missed','postponed','cancelled'].includes(m.status));
    return [...list].sort((a,b) => a.date > b.date ? 1 : -1);
  }, [monthMeetings, activeTab]);

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [showRecord, setShowRecord] = useState(false);
  const [momMeeting, setMomMeeting] = useState(null);
  const [modalPair,  setModalPair]  = useState('');

  const selectedPair = pairs.find(p => String(p.id) === modalPair);
  const { data: pairMembers = [] } = useQuery({
    queryKey: ['pair-members', modalPair],
    queryFn:  () => getUsersByUnits([selectedPair.unit_a.id, selectedPair.unit_b.id]),
    enabled:  !!selectedPair,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const momMutation = useMutation({
    mutationFn: ({ meetingId, data }) => submitMinutes(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['meetings'] });
      setMomMeeting(null);
      toast('Minutes saved');
    },
    onError: err => toast(getErrorMessage(err)),
  });

  const recordMutation = useMutation({
    mutationFn: ({ meetingId, data, outcome }) =>
      outcome === 'held' ? submitMinutes(meetingId, data) : recordNotHeld(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['meetings'] });
      setShowRecord(false);
      toast('Saved');
    },
    onError: err => toast(getErrorMessage(err)),
  });

  const handleRecord = async ({ selPair, mDate, outcome, attendees, summary, apItems, nhStatus, reason }) => {
    const pair = pairs.find(p => String(p.id) === selPair);
    if (!pair) return;
    setModalPair(selPair);
    const existing = meetings.find(m =>
      (m.pair.unit_a.slug===pair.unit_a.slug && m.pair.unit_b.slug===pair.unit_b.slug) ||
      (m.pair.unit_a.slug===pair.unit_b.slug && m.pair.unit_b.slug===pair.unit_a.slug)
    );
    if (outcome === 'held') {
      if (existing) {
        recordMutation.mutate({ meetingId:existing.id, data:{ attendees, summary, action_points:apItems, source:'written' }, outcome });
      } else {
        const m = await createMeeting({ pair_id:pair.id, date:mDate, status:'conducted', mtype:'In-person' });
        recordMutation.mutate({ meetingId:m.id, data:{ attendees, summary, action_points:apItems, source:'written' }, outcome });
      }
    } else {
      if (existing) {
        recordMutation.mutate({ meetingId:existing.id, data:{ status:nhStatus, reason }, outcome });
      } else {
        const m = await createMeeting({ pair_id:pair.id, date:mDate, status:nhStatus, mtype:'In-person' });
        recordMutation.mutate({ meetingId:m.id, data:{ status:nhStatus, reason }, outcome });
      }
    }
  };

  const TABS = [
    { key:'all',       label:'All' },
    { key:'upcoming',  label:'Upcoming' },
    { key:'conducted', label:'Conducted' },
    { key:'notheld',   label:'Not held' },
  ];

  return (
    <>
      {/* Filterbar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Minutes of meeting</div>
          <div className="v">{pocUnit ? `${pocUnit.name} workspace` : 'All meetings'}</div>
        </div>
        {user?.role === 'admin' && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div className="seg">
              {units.map(u => (
                <button key={u.slug} className={curPOC===u.slug?'on':''} onClick={() => { setCurPOC(u.slug); }}>
                  <span className="sw" style={{ background:u.color }} />{u.abbr}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Month strip */}
      <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
        {monthPills.map(mp => {
          const on = selMonth === mp.key;
          return (
            <button key={mp.key} type="button" onClick={() => setSelMonth(mp.key)}
              style={{ flexShrink:0, border:`1.5px solid ${on?'var(--accent)':'var(--line)'}`, borderRadius:20, padding:'6px 16px', fontSize:13, fontFamily:'var(--fb)', fontWeight:on?700:500, cursor:'pointer', background:on?'var(--accent)':'#fff', color:on?'#fff':'var(--ink2)', transition:'all .13s', display:'flex', alignItems:'center', gap:7, whiteSpace:'nowrap' }}>
              {mp.label}
              {mp.count > 0 && (
                <span style={{ background:on?'rgba(255,255,255,.25)':'var(--line)', color:on?'#fff':'var(--ink3)', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                  {mp.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status tabs + Record button */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div className="seg">
          {TABS.map(t => (
            <button key={t.key} className={activeTab===t.key?'on':''} onClick={() => setActiveTab(t.key)}>
              {t.label}
              {tabCounts[t.key] > 0 && (
                <span style={{ marginLeft:5, background:activeTab===t.key?'rgba(255,255,255,.25)':'var(--line)', color:activeTab===t.key?'#fff':'var(--ink3)', borderRadius:99, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                  {tabCounts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowRecord(true)}
          style={{ border:'none', borderRadius:20, padding:'9px 22px', fontSize:14, fontFamily:'var(--fb)', fontWeight:600, cursor:'pointer', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', gap:8, boxShadow:'0 1px 4px rgba(0,0,0,.18)', whiteSpace:'nowrap' }}
          onMouseEnter={e=>e.currentTarget.style.background='#1557b0'}
          onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}>
          + Record meeting
        </button>
      </div>

      {/* Meeting list */}
      {visible.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--ink3)', fontFamily:'var(--fm)', fontSize:14 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
          No {activeTab === 'all' ? '' : activeTab === 'notheld' ? 'not-held' : activeTab} meetings in {monthPills.find(m=>m.key===selMonth)?.label ?? selMonth}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {visible.map(m => (
            <MeetingRow key={m.id} meeting={m} onEnterMoM={setMomMeeting} />
          ))}
        </div>
      )}

      {/* Filed MoM details (conducted meetings with minutes) */}
      {activeTab === 'conducted' && visible.some(m => m.minutes) && (
        <div style={{ marginTop:28 }}>
          <div style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:12 }}>Filed minutes</div>
          {visible.filter(m=>m.minutes).map(m => {
            const A = m.pair.unit_a, B = m.pair.unit_b;
            const apDone  = m.minutes?.action_points?.filter(a=>a.done).length ?? 0;
            const apTotal = m.minutes?.action_points?.length ?? 0;
            return (
              <div key={m.id} style={{ border:'1px solid var(--line)', borderRadius:11, padding:'14px 16px', marginBottom:10, background:'#fff' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom: apTotal?12:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>📝</span>
                    <div>
                      <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:16, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:A.color, display:'inline-block' }} />{A.abbr}
                        <span style={{ color:'var(--ink3)', fontWeight:400, fontSize:13 }}>×</span>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:B.color, display:'inline-block' }} />{B.abbr}
                      </div>
                      <div style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink2)', marginTop:2, display:'flex', gap:10 }}>
                        <span>📅 {m.date}</span>
                        {m.minutes?.attendees && <span>👥 {m.minutes.attendees}</span>}
                        {m.minutes?.summary && <span style={{ maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.minutes.summary}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="button" onClick={()=>downloadPDF(m)} style={{ border:'1px solid var(--line)', borderRadius:7, padding:'5px 11px', background:'#fff', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink2)' }}>⬇ PDF</button>
                    <button type="button" onClick={()=>downloadWord(m)} style={{ border:'1px solid var(--line)', borderRadius:7, padding:'5px 11px', background:'#fff', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink2)' }}>⬇ Word</button>
                    <button type="button" onClick={()=>shareWhatsApp(m)} style={{ border:'none', borderRadius:7, padding:'5px 9px', background:'#25d366', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  </div>
                </div>
                {m.minutes?.action_points?.length > 0 && (
                  <div style={{ paddingTop:10, borderTop:'1px solid var(--line2)' }}>
                    {m.minutes.action_points.map((ap, ai) => {
                      const d = ap.deadline ? new Date(ap.deadline) : null;
                      const diff = d ? (d - new Date()) / (1000*60*60*24) : null;
                      const dColor = diff === null ? null : diff < 0 ? '#dc2626' : diff <= 3 ? '#f59e0b' : '#059669';
                      return (
                        <div key={ap.id??ai} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', fontSize:13 }}>
                          <span style={{ width:14, height:14, borderRadius:4, border:`1.5px solid ${ap.done?'var(--ok)':'var(--ink3)'}`, background:ap.done?'var(--ok)':'transparent', flexShrink:0 }} />
                          <span style={{ flex:1, color:ap.done?'var(--ink3)':'var(--ink)', textDecoration:ap.done?'line-through':'none' }}>{ap.text}</span>
                          {ap.assigned_to_name && <span style={{ fontSize:11, color:'var(--ink3)' }}>→ {ap.assigned_to_name}</span>}
                          {d && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:dColor, borderRadius:4, padding:'1px 6px' }}>{ap.deadline}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MoM Entry Modal */}
      {momMeeting && (
        <MomEntryModal
          meeting={momMeeting}
          onClose={() => setMomMeeting(null)}
          onSave={data => momMutation.mutate({ meetingId: momMeeting.id, data })}
          saving={momMutation.isPending}
        />
      )}

      {/* Record Modal (unchanged) */}
      {showRecord && (
        <RecordModal
          pairs={pairs}
          meetings={meetings}
          formPairs={formPairs}
          pocUnit={pocUnit}
          pairMembers={pairMembers}
          onClose={() => setShowRecord(false)}
          onSubmit={handleRecord}
          saving={recordMutation.isPending}
        />
      )}
    </>
  );
}
