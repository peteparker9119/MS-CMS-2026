import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings, submitMinutes, recordNotHeld, updateMeeting } from '../api/meetings';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import { getUsersByUnits } from '../api/items';
import DateField from '../components/DateField';

const ERR = { fontSize: 11, color: '#dc2626', marginTop: 4 };
import Badge from '../components/Badge';
import { downloadPDF, downloadWord } from '../utils/momExport';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormTextarea,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CSpinner, CRow, CCol,
} from '@coreui/react';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_COLORS = [
  '#6366f1','#ec4899','#f97316','#14b8a6','#22c55e','#3b82f6',
  '#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#10b981',
];
const DOW_S    = ['S','M','T','W','T','F','S'];
const STATUS_COLOR = { conducted:'#1D9E75', scheduled:'#378ADD', postponed:'#E0A21C', missed:'#D85A30' };
const LBL = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 };

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function shareWhatsApp(m) {
  const A = m.pair.unit_a, B = m.pair.unit_b;
  const mins = m.minutes;
  const lines = [
    '📋 MINUTES OF MEETING', '══════════════════════',
    `Meeting : ${A.name} × ${B.name}`,
    `Date    : ${m.date}${m.time ? ', ' + m.time : ''}`,
  ];
  if (mins?.attendees) lines.push(`Attended: ${mins.attendees}`);
  if (m.agenda)        lines.push('', '📌 AGENDA', m.agenda);
  if (mins?.summary)   lines.push('', '📝 SUMMARY', mins.summary);
  if (mins?.action_points?.length) {
    lines.push('', '✅ ACTION POINTS');
    mins.action_points.forEach(ap => lines.push(`${ap.done ? '☑' : '☐'} ${ap.aid ?? ''}: ${ap.text ?? ap}`));
  }
  lines.push('', '──────────────────────', 'MS - CMS Convergence — TN EMIS');
  window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
}

/* ── Mini calendar ─────────────────────────────────────── */
function MiniCalendar({ calMonth, setCalMonth, byDay, selDay, setSelDay, now }) {
  const year = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first    = new Date(year, mo, 1);
  const startDay = new Date(year, mo, 1 - first.getDay());
  const cells    = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDay); d.setDate(startDay.getDate() + i); return d;
  });

  return (
    <CCard>
      <CCardBody style={{ padding: '14px 16px' }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => setCalMonth(new Date(year, mo - 1, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink2)', lineHeight: 1, padding: '2px 6px' }}>‹</button>
          <div>
            <span style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>{MONTHS_S[mo]}</span>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)', marginLeft: 5 }}>{year}</span>
          </div>
          <button onClick={() => setCalMonth(new Date(year, mo + 1, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink2)', lineHeight: 1, padding: '2px 6px' }}>›</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
          {DOW_S.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', padding: '2px 0', letterSpacing: '.04em', fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            const key      = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const evs      = byDay[key] || [];
            const isOther  = d.getMonth() !== mo;
            const isToday  = d.toDateString() === now.toDateString();
            const isSel    = selDay && d.toDateString() === selDay.toDateString();
            const hasMeet  = evs.length > 0;
            return (
              <div key={i}
                onClick={() => setSelDay(isSel ? null : new Date(d))}
                style={{
                  height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', borderRadius: 7, cursor: hasMeet ? 'pointer' : 'default',
                  background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-light)' : 'transparent',
                  border: isToday && !isSel ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  opacity: isOther ? 0.3 : 1, transition: '.1s',
                }}
                onMouseEnter={e => { if (hasMeet && !isSel) e.currentTarget.style.background = 'var(--paper)'; }}
                onMouseLeave={e => { if (!isSel && !isToday) e.currentTarget.style.background = 'transparent'; else if (isToday && !isSel) e.currentTarget.style.background = 'var(--accent-light)'; }}
              >
                <span style={{ fontFamily: 'var(--fb)', fontSize: 13, fontWeight: isSel || isToday ? 700 : 400, color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>
                  {d.getDate()}
                </span>
                {hasMeet && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {evs.slice(0, 3).map((m, j) => (
                      <span key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,.7)' : (STATUS_COLOR[m.status] ?? '#ccc') }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Today button */}
        <div style={{ textAlign: 'center', marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <button onClick={() => { setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelDay(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--fb)', padding: '4px 12px', borderRadius: 6 }}>
            Today
          </button>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[['conducted','Conducted'],['scheduled','Scheduled'],['postponed','Postponed'],['missed','Missed']].map(([s, l]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--ink3)', fontFamily: 'var(--fm)' }}>{l}</span>
            </div>
          ))}
        </div>
      </CCardBody>
    </CCard>
  );
}

/* ── Inline MoM content ────────────────────────────────── */
function MomContent({ meeting }) {
  const mins = meeting.minutes;
  if (!mins) return <div style={{ fontSize: 13, color: 'var(--ink3)', fontStyle: 'italic' }}>No minutes filed yet.</div>;
  return (
    <div>
      {mins.attendees && (
        <div style={{ marginBottom: 10 }}>
          <div style={LBL}>Attendees</div>
          <div style={{ fontSize: 15 }}>{mins.attendees}</div>
        </div>
      )}
      {mins.summary && (
        <div style={{ marginBottom: 10 }}>
          <div style={LBL}>Summary</div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink2)' }}>{mins.summary}</div>
        </div>
      )}
      {mins.action_points?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={LBL}>Action Points</div>
            <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>
              {mins.action_points.filter(a => a.done).length}/{mins.action_points.length} done
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 5, background: 'var(--line)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${mins.action_points.length ? Math.round(mins.action_points.filter(a=>a.done).length / mins.action_points.length * 100) : 0}%`, background: 'var(--ok)', borderRadius: 99 }} />
          </div>
          {mins.action_points.map((ap, i) => {
            const d = ap.deadline ? new Date(ap.deadline + 'T00:00:00') : null;
            const diff = d ? Math.floor((d - new Date()) / (1000*60*60*24)) : null;
            const isOverdue = diff !== null && diff < 0 && !ap.done;
            const statusLabel = ap.done ? 'DONE' : isOverdue ? 'OVERDUE' : 'PENDING';
            const statusBg    = ap.done ? '#dcfce7' : isOverdue ? '#fee2e2' : '#f1f5f9';
            const statusColor = ap.done ? '#15803d' : isOverdue ? '#dc2626' : '#64748b';
            return (
              <div key={ap.id ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 5, background: isOverdue ? '#fff8f8' : '#fafafa', border: `1px solid ${isOverdue ? '#fecaca' : 'var(--line2)'}` }}>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap', marginTop: 1, letterSpacing: '.03em' }}>
                  {ap.done ? '✓' : isOverdue ? '⚠' : '○'} {statusLabel}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: ap.done ? 'var(--ink3)' : 'var(--ink)', textDecoration: ap.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{ap.text ?? ap}</span>
                {ap.assigned_to_name && (
                  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--ink2)', background: '#f1f5f9', border: '1px solid var(--line)', borderRadius: 20, padding: '2px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ap.assigned_to_name.charAt(0).toUpperCase()}
                    </span>
                    {ap.assigned_to_name}
                  </span>
                )}
                {(ap.start_date || ap.deadline) && (
                  <span style={{ flexShrink: 0, fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--ink3)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 500 }}>
                    {ap.start_date ? `${ap.start_date} → ` : ''}{ap.deadline ?? ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Export row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={() => downloadPDF(meeting)}
          style={{ fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, border: '1px solid var(--line)', borderRadius: 7, padding: '6px 14px', background: '#fff', cursor: 'pointer', color: 'var(--ink2)' }}>
          ⬇ PDF
        </button>
        <button onClick={() => downloadWord(meeting)}
          style={{ fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, border: '1px solid var(--line)', borderRadius: 7, padding: '6px 14px', background: '#fff', cursor: 'pointer', color: 'var(--ink2)' }}>
          ⬇ Word
        </button>
        {mins.uploaded_file && (
          <a href={mins.uploaded_file} download={mins.filename || 'MoM'}
            style={{ fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, border: '1px solid var(--line)', borderRadius: 7, padding: '6px 14px', background: '#fff', cursor: 'pointer', color: 'var(--ink2)', textDecoration: 'none' }}>
            📎 {mins.filename || 'Uploaded file'}
          </a>
        )}
        <button onClick={() => shareWhatsApp(meeting)} title="Share on WhatsApp"
          style={{ border: 'none', borderRadius: 7, padding: '6px 9px', background: '#25d366', cursor: 'pointer', color: '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Cascading action point row ─────────────────────────── */
function ActionPointRow({ ap, index, unitA, unitB, usersByUnit, onUpdate, onRemove, showRemove }) {
  const INP = { border:'1px solid var(--line)', borderRadius:8, padding:'8px 12px', fontSize:14, fontFamily:'var(--fm)', color:'var(--ink)', width:'100%', boxSizing:'border-box', outline:'none', background:'#fff' };
  const showUnit     = ap.text.trim().length > 0;
  const showUser     = showUnit && ap.unitId !== null;
  const showDeadline = showUser && ap.userId !== null;
  const users        = usersByUnit[ap.unitId] ?? [];
  return (
    <div style={{ border:'1px solid var(--line)', borderRadius:10, padding:'12px 14px', marginBottom:10, background:'#fafbfc', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:700, color:'var(--ink3)', minWidth:20 }}>{index+1}</span>
        <input style={{ ...INP, flex:1 }} value={ap.text} onChange={e => onUpdate(index,'text',e.target.value)}
          placeholder="What needs to be done…"
          onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'} />
        {showRemove && <button type="button" onClick={()=>onRemove(index)} style={{ border:'1px solid #fca5a5', borderRadius:8, background:'#fff5f5', color:'#dc2626', width:32, height:36, fontSize:18, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>}
      </div>
      {showUnit && (
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:30 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>Assign to</span>
          <div style={{ display:'flex', gap:8 }}>
            {[unitA, unitB].filter(Boolean).map(unit => {
              const on = ap.unitId === unit.id;
              return (
                <button key={unit.id} type="button" onClick={()=>onUpdate(index,'unitId', on ? null : unit.id)}
                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', border:`1.5px solid ${on?unit.color:'var(--line)'}`, borderRadius:20, cursor:'pointer', background:on?unit.color:'#fff', color:on?'#fff':'var(--ink)', fontFamily:'var(--fb)', fontSize:13, fontWeight:on?700:500, transition:'all .12s' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:on?'rgba(255,255,255,.7)':unit.color, flexShrink:0 }} />{unit.abbr}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showUser && (
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft:30 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>Person</span>
          <select value={ap.userId??''} onChange={e=>onUpdate(index,'userId',e.target.value?Number(e.target.value):null)}
            style={{ ...INP, flex:1, maxWidth:300, fontSize:13, cursor:'pointer' }}
            onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--line)'}>
            <option value="">— Select person —</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      {showDeadline && (
        <div style={{ display:'flex', alignItems:'center', gap:12, paddingLeft:30, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>From</span>
          <DateField value={ap.startDate} onChange={v=>onUpdate(index,'startDate',v)} placeholder="Start date" style={{ display:'inline-block' }} />
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', fontWeight:600, whiteSpace:'nowrap' }}>To</span>
          <DateField value={ap.deadline} onChange={v=>onUpdate(index,'deadline',v)} placeholder="Deadline" style={{ display:'inline-block' }} />
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
const TABS = [
  { key: 'all',       label: 'All'        },
  { key: 'upcoming',  label: 'Upcoming'   },
  { key: 'conducted', label: 'Conducted'  },
  { key: 'notheld',   label: 'Not Held'   },
];

export default function MeetingsPage() {
  const toast    = useToast();
  const qc       = useQueryClient();
  const { user } = useAuth();
  const now      = new Date();
  const isAdmin  = ['admin', 'super_admin'].includes(user?.role);

  const [calMonth,    setCalMonth]    = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selDay,      setSelDay]      = useState(null);
  const [tab,         setTab]         = useState('all');
  const [expanded,    setExpanded]    = useState(new Set());
  const [monthFilter, setMonthFilter] = useState(null); // single month (1-12) or null

  /* Reschedule modal state */
  const [rsOpen,    setRsOpen]    = useState(false);
  const [rsMeeting, setRsMeeting] = useState(null);
  const [rsDate,    setRsDate]    = useState('');
  const [rsTime,    setRsTime]    = useState('');
  const [rsAgenda,  setRsAgenda]  = useState('');
  const [rsFe,      setRsFe]      = useState({});

  /* MoM modal state */
  const [momOpen,    setMomOpen]    = useState(false);
  const [momMeeting, setMomMeeting] = useState(null);
  const [momMode,    setMomMode]    = useState(null);
  const [attendees,  setAttendees]  = useState('');
  const [summary,    setSummary]    = useState('');
  const [aps,        setAps]        = useState([{ id:null, text:'', unitId:null, userId:null, startDate:'', deadline:'' }]);
  const [nhStatus,   setNhStatus]   = useState('postponed');
  const [reason,     setReason]     = useState('');
  const [momFe,      setMomFe]      = useState({});

  const momUnitA = momMeeting?.pair?.unit_a;
  const momUnitB = momMeeting?.pair?.unit_b;
  const { data: momUsersA = [] } = useQuery({ queryKey:['users-by-unit', momUnitA?.id], queryFn:()=>getUsersByUnits([momUnitA.id]), enabled:!!momUnitA, staleTime:5*60*1000 });
  const { data: momUsersB = [] } = useQuery({ queryKey:['users-by-unit', momUnitB?.id], queryFn:()=>getUsersByUnits([momUnitB.id]), enabled:!!momUnitB, staleTime:5*60*1000 });
  const momUsersByUnit = momUnitA && momUnitB ? { [momUnitA.id]: momUsersA, [momUnitB.id]: momUsersB } : {};

  // Once user queries load, derive which unit each assigned person belongs to
  useEffect(() => {
    if (!momUsersA.length && !momUsersB.length) return;
    setAps(prev => prev.map(ap => {
      if (ap.unitId !== null || !ap.userId) return ap;
      if (momUsersA.some(u => u.id === ap.userId)) return { ...ap, unitId: momUnitA.id };
      if (momUsersB.some(u => u.id === ap.userId)) return { ...ap, unitId: momUnitB.id };
      return ap;
    }));
  }, [momUsersA, momUsersB]); // eslint-disable-line

  const addAP    = () => setAps(p=>[...p,{ id:null, text:'', unitId:null, userId:null, startDate:'', deadline:'' }]);
  const removeAP = i  => setAps(p=>p.filter((_,idx)=>idx!==i));
  const updateAP = (i,field,value) => setAps(prev=>prev.map((ap,idx)=>{
    if(idx!==i) return ap;
    const u={...ap,[field]:value};
    if(field==='text')   { u.unitId=null; u.userId=null; u.startDate=''; u.deadline=''; }
    if(field==='unitId') { u.userId=null; u.startDate=''; u.deadline=''; }
    if(field==='userId') { u.startDate=''; u.deadline=''; }
    return u;
  }));

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => getMeetings({}),
  });

  /* Calendar dot map */
  const byDay = useMemo(() => {
    const map = {};
    meetings.forEach(m => {
      const d   = new Date(m.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] = map[key] || []).push(m);
    });
    return map;
  }, [meetings]);

  /* Years available in data */
  const years = useMemo(() => {
    const set = new Set();
    meetings.forEach(m => { if (m.date) set.add(String(new Date(m.date).getFullYear())); });
    if (!set.size) set.add(String(now.getFullYear()));
    return [...set].sort().reverse();
  }, [meetings, now]);

  const calYear = String(calMonth.getFullYear());

  /* Per-month counts for the calendar year */
  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    meetings.forEach(m => {
      if (!m.date) return;
      const d = new Date(m.date);
      if (String(d.getFullYear()) === calYear) counts[d.getMonth()]++;
    });
    return counts;
  }, [meetings, calYear]);

  /* Filtered list */
  const todayISO = toISO(now);
  const filtered = useMemo(() => {
    let list = [...meetings];

    // Year filter — matches calendar year
    list = list.filter(m => m.date && String(new Date(m.date).getFullYear()) === calYear);

    // Month filter
    if (monthFilter)
      list = list.filter(m => m.date && new Date(m.date).getMonth() + 1 === monthFilter);

    // Day filter from calendar click
    if (selDay) {
      const key = toISO(selDay);
      list = list.filter(m => m.date === key);
    }

    // Tab filter
    if (tab === 'upcoming')  list = list.filter(m => m.status === 'scheduled' && m.date >= todayISO);
    if (tab === 'conducted') list = list.filter(m => m.status === 'conducted');
    if (tab === 'notheld')   list = list.filter(m => m.status === 'postponed' || m.status === 'missed');

    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [meetings, tab, selDay, todayISO, monthFilter, calYear]);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* MoM mutation */
  const momMutation = useMutation({
    mutationFn: ({ meetingId, data, type }) =>
      type === 'minutes' ? submitMinutes(meetingId, data) : recordNotHeld(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setMomOpen(false); setMomMeeting(null); setMomMode(null);
      setAttendees(''); setSummary(''); setAps([{ id:null,text:'',unitId:null,userId:null,startDate:'',deadline:'' }]); setReason('');
      toast(momMode === 'conduct' ? 'Minutes filed' : 'Recorded');
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  /* Reschedule mutation (admin only) */
  const rsMutation = useMutation({
    mutationFn: ({ id, data }) => updateMeeting(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setRsOpen(false); setRsMeeting(null); setRsFe({});
      toast('Meeting rescheduled');
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const openReschedule = (m, e) => {
    e.stopPropagation();
    setRsMeeting(m);
    setRsDate(m.date);
    setRsTime(m.time ?? '');
    setRsAgenda(m.agenda ?? '');
    setRsFe({});
    setRsOpen(true);
  };

  const handleReschedule = () => {
    if (!rsDate) { setRsFe({ rsDate: 'Select a new date for the meeting' }); return; }
    setRsFe({});
    rsMutation.mutate({ id: rsMeeting.id, data: { date: rsDate, time: rsTime || null, agenda: rsAgenda } });
  };

  const handleMomSubmit = () => {
    if (momMode === 'conduct') {
      const cleanAps = aps.filter(ap=>ap.text.trim()).map(ap=>({ text:ap.text.trim(), responsible_unit:ap.unitId??null, assigned_to:ap.userId??null, start_date:ap.startDate||null, deadline:ap.deadline||null }));
      if (!summary && !cleanAps.length) { setMomFe({ summary: 'Add a summary or at least one action point' }); return; }
      setMomFe({});
      momMutation.mutate({ meetingId: momMeeting.id, data: { attendees, summary, action_points: cleanAps, source: 'written' }, type: 'minutes' });
    } else {
      if (!reason) { setMomFe({ reason: 'Provide a reason for not holding the meeting' }); return; }
      setMomFe({});
      momMutation.mutate({ meetingId: momMeeting.id, data: { status: nhStatus, reason }, type: 'notheld' });
    }
  };

  const openMom = (m, editExisting = false) => {
    setMomMeeting(m);
    if (editExisting && m.minutes) {
      setMomMode('conduct');
      setAttendees(m.minutes.attendees ?? '');
      setSummary(m.minutes.summary ?? '');
      setAps((m.minutes.action_points ?? []).length
        ? m.minutes.action_points.map(ap=>({ id:ap.id??null, text:ap.text??'', unitId:ap.responsible_unit??null, userId:ap.assigned_to??null, startDate:ap.start_date??'', deadline:ap.deadline??'' }))
        : [{ id:null, text:'', unitId:null, userId:null, startDate:'', deadline:'' }]);
    } else {
      setMomMode(null);
      setAttendees(''); setSummary('');
      setAps([{ id:null, text:'', unitId:null, userId:null, startDate:'', deadline:'' }]);
    }
    setReason(''); setNhStatus('postponed');
    setMomOpen(true);
  };

  /* Tab counts — scoped to current year + month selection */
  const scopedMeetings = useMemo(() => {
    let list = meetings.filter(m => m.date && String(new Date(m.date).getFullYear()) === calYear);
    if (monthFilter)
      list = list.filter(m => new Date(m.date).getMonth() + 1 === monthFilter);
    return list;
  }, [meetings, calYear, monthFilter]);

  const counts = useMemo(() => ({
    all:       scopedMeetings.length,
    upcoming:  scopedMeetings.filter(m => m.status === 'scheduled' && m.date >= todayISO).length,
    conducted: scopedMeetings.filter(m => m.status === 'conducted').length,
    notheld:   scopedMeetings.filter(m => m.status === 'postponed' || m.status === 'missed').length,
  }), [scopedMeetings, todayISO]);

  const year = calMonth.getFullYear(), mo = calMonth.getMonth();

  return (
    <>
      {/* Filter bar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Meetings</div>
          <div className="v">{selDay ? `${selDay.getDate()} ${MONTHS_S[selDay.getMonth()]} ${selDay.getFullYear()}` : `${MONTHS[mo]} ${year}`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Year buttons */}
          <div className="seg">
            {years.map(y => (
              <button key={y} className={calYear === y ? 'on' : ''} onClick={() => { setCalMonth(new Date(Number(y), now.getMonth(), 1)); setMonthFilter(null); setSelDay(null); }}>{y}</button>
            ))}
          </div>
          {/* Tab pills */}
          <div className="seg">
            {TABS.map(t => (
              <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => { setTab(t.key); setSelDay(null); }}>
                {t.label}
                {counts[t.key] > 0 && (
                  <span style={{ marginLeft: 5, background: tab === t.key ? 'rgba(255,255,255,.25)' : 'var(--line)', color: tab === t.key ? '#fff' : 'var(--ink3)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month filter cards */}
      <CCard className="mb-3" style={{ border: '1px solid var(--line)' }}>
        <CCardBody style={{ padding: '10px 14px' }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Month — {calYear}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 5 }}>
            {MONTHS_S.map((m, i) => {
              const mo     = i + 1;
              const cnt    = monthCounts[i];
              const active = monthFilter === mo;
              const color  = MONTH_COLORS[i];
              return (
                <div key={m} onClick={() => setMonthFilter(prev => prev === mo ? null : mo)}
                  style={{
                    padding: '5px 2px', borderRadius: 7, textAlign: 'center', cursor: 'pointer', transition: 'all .13s',
                    border: `1.5px solid ${active ? color : 'var(--line)'}`,
                    background: active ? color : '#fff',
                    opacity: cnt === 0 && !active ? 0.45 : 1,
                  }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 9, fontWeight: 700, color: active ? '#fff' : 'var(--ink)', letterSpacing: '.03em' }}>{m}</div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: active ? '#fff' : 'var(--ink)', lineHeight: 1.3 }}>{cnt}</div>
                </div>
              );
            })}
          </div>
        </CCardBody>
      </CCard>

      <CRow className="g-3">
        {/* ── Left: mini calendar ── */}
        <CCol lg={3} md={4}>
          <MiniCalendar
            calMonth={calMonth} setCalMonth={setCalMonth}
            byDay={byDay} selDay={selDay} setSelDay={setSelDay} now={now}
          />
        </CCol>

        {/* ── Right: meeting list ── */}
        <CCol lg={9} md={8}>
          <CCard>
            <CCardBody style={{ padding: 0 }}>
              {/* List header */}
              <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18 }}>
                  {selDay ? `${selDay.getDate()} ${MONTHS_S[selDay.getMonth()]} ${selDay.getFullYear()}` : TABS.find(t => t.key === tab)?.label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  {isLoading ? <CSpinner size="sm" /> : `${filtered.length} meeting${filtered.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Empty state */}
              {!isLoading && filtered.length === 0 && (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink3)', fontSize: 15 }}>
                  No meetings in this view.
                </div>
              )}

              {/* Meeting rows */}
              {filtered.map(m => {
                const A       = m.pair.unit_a, B = m.pair.unit_b;
                const isOpen  = expanded.has(m.id);
                const isUpcoming = m.status === 'scheduled' && m.date >= todayISO;
                const isPast     = m.status === 'scheduled' && m.date < todayISO;

                return (
                  <div key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    {/* ── Row ── */}
                    <div
                      onClick={() => toggleExpand(m.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px auto 1fr auto 32px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 18px',
                        cursor: 'pointer',
                        background: isOpen ? 'var(--accent-light)' : '#fff',
                        transition: 'background .13s',
                      }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--paper)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isOpen ? 'var(--accent-light)' : '#fff'; }}
                    >
                      {/* Date */}
                      <div>
                        <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{m.date}</div>
                        {m.time && <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{m.time}</div>}
                      </div>

                      {/* Units */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: A.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--fb)', fontWeight: 600, fontSize: 15 }}>{A.abbr}</span>
                        <span style={{ color: 'var(--ink3)', fontSize: 13, fontWeight: 400 }}>×</span>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: B.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--fb)', fontWeight: 600, fontSize: 15 }}>{B.abbr}</span>
                      </div>

                      {/* Snippet */}
                      <div style={{ fontSize: 13, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.minutes?.summary
                          ? m.minutes.summary.slice(0, 90) + (m.minutes.summary.length > 90 ? '…' : '')
                          : m.agenda
                          ? m.agenda.slice(0, 90) + (m.agenda.length > 90 ? '…' : '')
                          : m.mtype ? `${m.mtype === 'In-person' ? '📍' : '💻'} ${m.mtype}` : ''}
                      </div>

                      {/* Status badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge status={isUpcoming ? 'scheduled' : isPast ? 'scheduled' : m.status} />
                      </div>

                      {/* Chevron */}
                      <div style={{ color: 'var(--ink3)', fontSize: 18, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none', textAlign: 'center' }}>›</div>
                    </div>

                    {/* ── Expanded panel ── */}
                    {isOpen && (
                      <div style={{ padding: '16px 22px 20px', background: 'var(--paper)', borderTop: '1px solid var(--accent-light)' }}>

                        {/* Meeting meta */}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                          <span style={{ fontSize: 15, color: 'var(--ink2)' }}>
                            <span style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', marginRight: 5 }}>Pair</span>
                            {A.name} × {B.name}
                          </span>
                          {m.mtype && (
                            <span style={{ fontSize: 15, color: 'var(--ink2)' }}>
                              {m.mtype === 'In-person' ? '📍' : '💻'} {m.mtype}
                            </span>
                          )}
                        </div>

                        {m.agenda && (
                          <div style={{ marginBottom: 14, padding: '10px 13px', background: '#fff', borderRadius: 8, border: '1px solid var(--line)' }}>
                            <div style={LBL}>Agenda</div>
                            <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink2)' }}>{m.agenda}</div>
                          </div>
                        )}

                        {/* Conducted → show MOM inline + edit button */}
                        {m.status === 'conducted' && (
                          <div style={{ padding: '14px', background: '#fff', borderRadius: 10, border: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div style={{ ...LBL, color: '#059669', marginBottom: 0 }}>Minutes of Meeting</div>
                              {isAdmin && (
                                <CButton size="sm" color="dark" variant="outline"
                                  onClick={(e) => { e.stopPropagation(); openMom(m, true); }}
                                  style={{ fontFamily: 'var(--fb)', fontSize: 11 }}>
                                  ✎ Edit MoM
                                </CButton>
                              )}
                            </div>
                            <MomContent meeting={m} />
                          </div>
                        )}

                        {/* Postponed/Missed → show reason */}
                        {(m.status === 'postponed' || m.status === 'missed') && (
                          <div style={{ padding: '12px 14px', background: '#fff', borderRadius: 9, border: `1px solid ${m.status === 'missed' ? '#fca5a5' : '#fde68a'}` }}>
                            <div style={LBL}>{m.status === 'missed' ? 'Missed — reason' : 'Postponed — reason'}</div>
                            <div style={{ fontSize: 15, color: 'var(--ink2)' }}>{m.reason ?? m.not_held?.reason ?? '—'}</div>
                          </div>
                        )}

                        {/* Scheduled → Enter MoM + admin Reschedule */}
                        {m.status === 'scheduled' && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {isAdmin && (
                              <CButton size="sm" color="dark"
                                onClick={(e) => { e.stopPropagation(); openMom(m); }}
                                style={{ fontFamily: 'var(--fb)', fontSize: 15 }}>
                                ✅ Enter MoM
                              </CButton>
                            )}
                            {isAdmin && (
                              <CButton size="sm" color="secondary" variant="outline"
                                onClick={(e) => openReschedule(m, e)}
                                style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                                ✎ Reschedule
                              </CButton>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Reschedule modal (admin only) ── */}
      {rsMeeting && (
        <CModal visible={rsOpen} onClose={() => { setRsOpen(false); setRsMeeting(null); }} size="md" alignment="center">
          <CModalHeader style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18 }}>
              Reschedule — {rsMeeting.pair.unit_a.abbr} × {rsMeeting.pair.unit_b.abbr}
            </CModalTitle>
          </CModalHeader>
          <CModalBody style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
              <div>
                <CFormLabel style={LBL}>New date</CFormLabel>
                <CFormInput type="date" value={rsDate}
                  onChange={e => { setRsDate(e.target.value); setRsFe({}); }}
                  style={rsFe.rsDate ? { borderColor: '#dc2626' } : {}} />
                {rsFe.rsDate && <div style={ERR}>⚠ {rsFe.rsDate}</div>}
              </div>
              <div>
                <CFormLabel style={LBL}>Time</CFormLabel>
                <CFormInput type="time" value={rsTime} onChange={e => setRsTime(e.target.value)} />
              </div>
            </div>
            <div>
              <CFormLabel style={LBL}>Agenda <span style={{ textTransform: 'none', opacity: .6 }}>(optional)</span></CFormLabel>
              <CFormTextarea value={rsAgenda} onChange={e => setRsAgenda(e.target.value)} placeholder="Updated agenda…" rows={2} style={{ resize: 'none' }} />
            </div>
          </CModalBody>
          <CModalFooter style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <CButton color="secondary" variant="outline" onClick={() => { setRsOpen(false); setRsMeeting(null); }} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>Cancel</CButton>
            <CButton color="dark" onClick={handleReschedule} disabled={rsMutation.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
              {rsMutation.isPending ? 'Saving…' : 'Save changes'}
            </CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* ── MoM entry modal (for scheduled meetings only) ── */}
      {momMeeting && (
        <CModal visible={momOpen} onClose={() => { setMomOpen(false); setMomMeeting(null); setMomMode(null); }} size="lg" alignment="center">
          <CModalHeader>
            <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18 }}>
              {momMeeting.pair.unit_a.abbr} × {momMeeting.pair.unit_b.abbr} — {momMeeting.date}
              {momMeeting.status === 'conducted' && momMeeting.minutes ? ' · Edit MoM' : ''}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {momMeeting.agenda && (
              <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)', marginBottom: 16, padding: '10px 12px', background: 'var(--paper)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <span style={{ ...LBL, display: 'block', marginBottom: 4 }}>Agenda</span>
                {momMeeting.agenda}
              </div>
            )}

            {!momMode && (
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <CButton color="dark" onClick={() => setMomMode('conduct')} style={{ fontFamily: 'var(--fb)' }}>
                  ✅ Mark Conducted — Enter MoM
                </CButton>
                <CButton color="secondary" variant="outline" onClick={() => setMomMode('notheld')} style={{ fontFamily: 'var(--fb)' }}>
                  ⚠ Record Not Held
                </CButton>
              </div>
            )}

            {momMode === 'conduct' && (
              <>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Attendees present</CFormLabel>
                  <CFormInput value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="e.g. 6 of 8" />
                </div>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Summary / discussion</CFormLabel>
                  <CFormTextarea value={summary}
                    onChange={e => { setSummary(e.target.value); setMomFe({}); }}
                    placeholder="What was discussed and decided…" rows={3}
                    style={momFe.summary ? { borderColor: '#dc2626' } : {}} />
                  {momFe.summary && <div style={ERR}>⚠ {momFe.summary}</div>}
                </div>
                <div className="mb-3">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <CFormLabel style={{ ...LBL, marginBottom:0 }}>Action Points</CFormLabel>
                    <button type="button" onClick={addAP} style={{ border:'1.5px solid var(--accent)', borderRadius:16, padding:'4px 14px', background:'var(--accent-light)', color:'var(--accent)', fontFamily:'var(--fb)', fontSize:12, fontWeight:700, cursor:'pointer' }}>+ Add</button>
                  </div>
                  {aps.map((ap,i)=>(
                    <ActionPointRow key={i} ap={ap} index={i} unitA={momUnitA} unitB={momUnitB} usersByUnit={momUsersByUnit} onUpdate={updateAP} onRemove={removeAP} showRemove={aps.length>1} />
                  ))}
                </div>
              </>
            )}

            {momMode === 'notheld' && (
              <>
                <div className="mb-3">
                  <CFormLabel style={LBL}>What happened</CFormLabel>
                  <div className="d-flex gap-2">
                    {[['postponed', '🕘 Postponed'], ['missed', '✕ Missed']].map(([v, l]) => (
                      <label key={v} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1px solid ${nhStatus === v ? 'var(--warn)' : 'var(--line)'}`, borderRadius: 9, padding: '10px 8px', fontSize: 13, cursor: 'pointer', background: nhStatus === v ? '#fbf0d9' : '#fff', fontWeight: nhStatus === v ? 600 : 400, color: nhStatus === v ? '#8B5E08' : 'var(--ink)', height: 38 }}>
                        <input type="radio" name="nhstatus" style={{ display: 'none' }} checked={nhStatus === v} onChange={() => setNhStatus(v)} />{l}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Reason</CFormLabel>
                  <CFormTextarea value={reason}
                    onChange={e => { setReason(e.target.value); setMomFe({}); }}
                    placeholder="e.g. Key members on field duty…" rows={3}
                    style={momFe.reason ? { borderColor: '#dc2626' } : {}} />
                  {momFe.reason && <div style={ERR}>⚠ {momFe.reason}</div>}
                </div>
              </>
            )}
          </CModalBody>
          {(momMode === 'conduct' || momMode === 'notheld') && (
            <CModalFooter>
              <CButton color="secondary" variant="outline" onClick={() => setMomMode(null)} style={{ fontFamily: 'var(--fb)' }}>Back</CButton>
              <CButton color="dark" onClick={handleMomSubmit} disabled={momMutation.isPending} style={{ fontFamily: 'var(--fb)' }}>
                {momMutation.isPending ? <CSpinner size="sm" /> : (momMode === 'conduct' ? 'Submit MoM' : 'Record')}
              </CButton>
            </CModalFooter>
          )}
        </CModal>
      )}
    </>
  );
}
