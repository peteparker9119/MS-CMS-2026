import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings, createMeeting, updateMeeting, cancelMeeting } from '../api/meetings';
import { getPairs } from '../api/units';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import WeekCalendar from '../components/WeekCalendar';
import EventModal from '../components/EventModal';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const GS = 'Google Sans,Roboto,sans-serif';
const RI = 'Roboto,sans-serif';

const STATUS_COLOR = {
  scheduled: '#1a73e8',
  conducted: '#0b8043',
  postponed: '#e37400',
  missed:    '#d93025',
  cancelled: '#80868b',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonday(d) {
  const day = d.getDay();
  const m   = new Date(d);
  m.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  m.setHours(0, 0, 0, 0);
  return m;
}
function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h-12 : h === 0 ? 12 : h;
  return m === 0 ? `${hr} ${ap}` : `${hr}:${String(m).padStart(2,'0')} ${ap}`;
}

// ── Reason / cancel modal ─────────────────────────────────────────────────────
function ReasonModal({ meeting, onConfirm, onClose, saving }) {
  const [reason, setReason] = useState('');
  const A = meeting?.pair?.unit_a, B = meeting?.pair?.unit_b;
  const label = A && B ? `${A.abbr} × ${B.abbr}` : 'this meeting';
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1049 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1050, width:'min(420px,96vw)', background:'#fff', borderRadius:12, boxShadow:'0 24px 48px rgba(0,0,0,.2)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:GS }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:16, fontWeight:500, color:'#3c4043' }}>Cancel meeting — {label}</span>
          <button onClick={onClose} type="button" style={{ border:'none', background:'none', cursor:'pointer', fontSize:18, color:'#5f6368', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontFamily:RI, fontSize:13, color:'#5f6368', lineHeight:1.5 }}>
            Provide a reason for cancelling the {label} meeting on <strong>{meeting?.date}</strong>.
          </div>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            style={{ resize:'none', border:'1px solid #dadce0', borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:RI, color:'#3c4043', outline:'none', width:'100%', boxSizing:'border-box' }}
            onFocus={e => e.target.style.borderColor='#1a73e8'}
            onBlur={e  => e.target.style.borderColor='#dadce0'}
          />
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid #e8eaed', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} type="button"
            style={{ border:'1px solid #dadce0', borderRadius:4, padding:'7px 18px', fontSize:13, fontFamily:GS, fontWeight:500, cursor:'pointer', background:'#fff', color:'#1a73e8' }}>
            Back
          </button>
          <button onClick={() => onConfirm(reason)} disabled={saving} type="button"
            style={{ border:'none', borderRadius:4, padding:'7px 18px', fontSize:13, fontFamily:GS, fontWeight:500, cursor:saving?'not-allowed':'pointer', background:'#d93025', color:'#fff', opacity:saving?.7:1 }}>
            {saving ? 'Cancelling…' : 'Cancel meeting'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── GCal Mini Month Calendar ──────────────────────────────────────────────────
function MiniCalendar({ meetings, onDateClick, weekStart }) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const mo   = month.getMonth();
  const yr   = month.getFullYear();

  const days = useMemo(() => {
    const first = new Date(yr, mo, 1);
    const start = new Date(yr, mo, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [yr, mo]);

  const eventDays = useMemo(() => {
    const s = new Set();
    meetings.forEach(m => { if (m.date) s.add(m.date); });
    return s;
  }, [meetings]);

  const weekDates = useMemo(() => {
    const s = new Set();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      s.add(toIso(d));
    }
    return s;
  }, [weekStart]);

  const todayIso = toIso(now);

  return (
    <div style={{ userSelect:'none' }}>
      {/* Month header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 2px 8px' }}>
        <span style={{ fontFamily:GS, fontSize:14, fontWeight:500, color:'#3c4043', cursor:'default' }}>
          {MONTHS_S[mo]} {yr}
        </span>
        <div style={{ display:'flex', gap:2 }}>
          {[['‹', -1],['›', 1]].map(([icon, dir]) => (
            <button key={dir} type="button"
              onClick={() => setMonth(new Date(yr, mo + dir, 1))}
              style={{ border:0, background:'none', cursor:'pointer', width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#5f6368', fontSize:18, fontWeight:300 }}
              onMouseEnter={e => e.currentTarget.style.background='#f1f3f4'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* DOW headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} style={{ fontFamily:RI, fontSize:11, color:'#70757a', textAlign:'center', padding:'3px 0', fontWeight:500, letterSpacing:'.3px' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
        {days.map((d, i) => {
          const iso      = toIso(d);
          const isOther  = d.getMonth() !== mo;
          const isToday  = iso === todayIso;
          const inWeek   = weekDates.has(iso);
          const hasEvent = eventDays.has(iso);
          return (
            <div key={i} onClick={() => onDateClick(new Date(d))}
              title={iso}
              style={{ height:32, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', borderRadius:'50%', cursor:'pointer', position:'relative', background: isToday ? '#1a73e8' : inWeek ? '#e8f0fe' : 'transparent', color: isToday ? '#fff' : isOther ? '#bdc1c6' : '#3c4043', transition:'background .12s' }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = inWeek ? '#d2e3fc' : '#f1f3f4'; }}
              onMouseLeave={e => { e.currentTarget.style.background = isToday ? '#1a73e8' : inWeek ? '#e8f0fe' : 'transparent'; }}>
              <span style={{ fontFamily:RI, fontSize:12, fontWeight: isToday?700:400, lineHeight:1 }}>{d.getDate()}</span>
              {hasEvent && !isToday && (
                <span style={{ width:4, height:4, borderRadius:'50%', background: inWeek ? '#1a73e8' : '#70757a', position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Upcoming meetings list (sidebar) ──────────────────────────────────────────
function UpcomingList({ meetings, onOpen }) {
  const now = new Date();
  const list = useMemo(() =>
    meetings
      .filter(m => m.status === 'scheduled' && new Date(m.date + 'T00:00:00') >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 8),
    [meetings] // eslint-disable-line
  );

  if (list.length === 0) return (
    <div style={{ padding:'16px 4px 4px', fontFamily:RI, fontSize:12, color:'#80868b', textAlign:'center', lineHeight:1.6 }}>
      <div style={{ fontSize:28, marginBottom:6 }}>📅</div>
      No upcoming meetings
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:4 }}>
      <div style={{ fontFamily:RI, fontSize:11, fontWeight:600, color:'#5f6368', textTransform:'uppercase', letterSpacing:'.8px', padding:'4px 4px 6px' }}>
        Upcoming
      </div>
      {list.map(m => {
        const A = m.pair?.unit_a, B = m.pair?.unit_b;
        const d = new Date(m.date + 'T00:00:00');
        const isToday = m.date === toIso(now);
        const color = A?.color || STATUS_COLOR.scheduled;
        return (
          <div key={m.id} onClick={() => onOpen(m)}
            style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 6px', borderRadius:10, cursor:'pointer', transition:'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background='#f1f3f4'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            {/* Date badge */}
            <div style={{ flexShrink:0, width:36, textAlign:'center', background: isToday ? '#e8f0fe' : '#f8f9fa', borderRadius:8, padding:'4px 0' }}>
              <div style={{ fontFamily:RI, fontSize:9, textTransform:'uppercase', color: isToday ? '#1a73e8' : '#70757a', letterSpacing:'.5px', fontWeight:600 }}>
                {MONTHS_S[d.getMonth()]}
              </div>
              <div style={{ fontFamily:GS, fontSize:17, fontWeight:500, color: isToday ? '#1a73e8' : '#3c4043', lineHeight:1.2 }}>
                {d.getDate()}
              </div>
            </div>
            {/* Event info */}
            <div style={{ flex:1, minWidth:0, paddingTop:1 }}>
              <div style={{ fontFamily:GS, fontSize:12, fontWeight:500, color:'#3c4043', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {m.title || `${A?.abbr} × ${B?.abbr}`}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />
                <span style={{ fontFamily:RI, fontSize:11, color:'#5f6368', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{A?.abbr} × {B?.abbr}</span>
              </div>
              {m.time && (
                <div style={{ fontFamily:RI, fontSize:11, color:'#80868b', marginTop:2 }}>{fmtTime(m.time)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const toast      = useToast();
  const qc         = useQueryClient();
  const { user }   = useAuth();
  const now        = new Date();

  const [weekStart,   setWeekStart]   = useState(getMonday(now));
  const [eventModal,  setEventModal]  = useState(null);
  const [reasonModal, setReasonModal] = useState(null);

  const { data: pairs    = [] } = useQuery({ queryKey:['pairs'],    queryFn: getPairs });
  const { data: meetings = [] } = useQuery({ queryKey:['meetings'], queryFn: () => getMeetings({}) });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => { qc.invalidateQueries({ queryKey:['meetings'] }); setEventModal(null); toast('Meeting scheduled'); },
    onError:   () => toast('Failed to schedule'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateMeeting(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['meetings'] }); setEventModal(null); toast('Meeting updated'); },
    onError:   () => toast('Failed to update'),
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, data }) => updateMeeting(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['meetings'] }); toast('Meeting moved'); },
    onError:   () => toast('Failed to move'),
  });
  const resizeMutation = useMutation({
    mutationFn: ({ id, end_time }) => updateMeeting(id, { end_time }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['meetings'] }); },
    onError:   () => toast('Failed to update'),
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => cancelMeeting(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['meetings'] }); setReasonModal(null); toast('Meeting cancelled'); },
    onError:   () => toast('Failed to cancel'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // pos = { x, y } click coords so modal appears near the interaction point
  const openNewMeeting = (date, startMin, endMin, pos) =>
    setEventModal({ date: date instanceof Date ? toIso(date) : (date || ''), startMin, endMin, pos });

  const openEditMeeting = (meeting) => setEventModal({
    date:     meeting.date,
    startMin: meeting.time     ? timeToMin(meeting.time)     : undefined,
    endMin:   meeting.end_time ? timeToMin(meeting.end_time) : undefined,
    meeting,
  });

  const openCancel = (meeting) => setReasonModal({ meeting });

  // ── Week label ───────────────────────────────────────────────────────────────
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    : `${MONTHS_S[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS_S[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canCreate = isAdmin || user?.role === 'poc';
  const todayIso = toIso(now);

  // ── Chevron SVG helpers ───────────────────────────────────────────────────────
  const ChevL = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="15,18 9,12 15,6"/>
    </svg>
  );
  const ChevR = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  );

  return (
    <>
      {/* ── GCal-style full layout ── */}
      <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 87px)', margin:'-30px -44px 0', overflow:'hidden' }}>

        {/* ── Top toolbar ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderBottom:'1px solid #e8eaed', background:'#fff', flexShrink:0, flexWrap:'wrap' }}>
          {/* Hamburger placeholder (GCal has this) + brand */}
          <span style={{ fontFamily:GS, fontSize:20, fontWeight:400, color:'#5f6368', marginRight:4, letterSpacing:'-.5px' }}>
            Meeting Planner
          </span>

          <div style={{ flex:1 }} />

          {/* Today */}
          <button type="button" onClick={() => setWeekStart(getMonday(new Date()))}
            style={{ border:'1px solid #dadce0', borderRadius:6, padding:'6px 16px', fontSize:14, fontFamily:GS, fontWeight:500, cursor:'pointer', background:'#fff', color:'#3c4043', whiteSpace:'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            Today
          </button>

          {/* Prev / Next chevrons */}
          <div style={{ display:'inline-flex', border:'1px solid #dadce0', borderRadius:6, overflow:'hidden' }}>
            <button type="button"
              onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }}
              style={{ border:'none', borderRight:'1px solid #dadce0', background:'#fff', width:36, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5f6368' }}
              onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              <ChevL />
            </button>
            <button type="button"
              onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }}
              style={{ border:'none', background:'#fff', width:36, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5f6368' }}
              onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              <ChevR />
            </button>
          </div>

          {/* Week label */}
          <span style={{ fontFamily:GS, fontSize:18, fontWeight:400, color:'#3c4043', letterSpacing:'-.01em', minWidth:200 }}>
            {weekLabel}
          </span>

          {/* New meeting FAB */}
          {canCreate && (
            <button type="button"
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); openNewMeeting('', undefined, undefined, { x: r.left, y: r.bottom + 8 }); }}
              style={{ border:'none', borderRadius:20, padding:'8px 20px', fontSize:14, fontFamily:GS, fontWeight:500, cursor:'pointer', background:'#1a73e8', color:'#fff', display:'flex', alignItems:'center', gap:7, flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background='#1765cc'; e.currentTarget.style.boxShadow='0 2px 6px rgba(0,0,0,.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='#1a73e8'; e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.2)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New meeting
            </button>
          )}
        </div>

        {/* ── Body: sidebar + week grid ── */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

          {/* ── Left sidebar ── */}
          <div style={{ width:268, flexShrink:0, borderRight:'1px solid #e8eaed', background:'#fff', overflowY:'auto', padding:'16px 16px 24px' }}>
            {/* Mini month calendar */}
            <MiniCalendar
              meetings={meetings}
              onDateClick={(d) => setWeekStart(getMonday(d))}
              weekStart={weekStart}
            />

            {/* Divider */}
            <div style={{ height:1, background:'#e8eaed', margin:'16px -8px' }} />

            {/* Upcoming */}
            <UpcomingList meetings={meetings} onOpen={openEditMeeting} />
          </div>

          {/* ── Week grid ── */}
          <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
            <WeekCalendar
              weekStart={weekStart}
              meetings={meetings}
              height="100%"
              onSlotClick={(date, startMin, endMin, pos)  => openNewMeeting(date, startMin, endMin, pos)}
              onDragCreate={(date, startMin, endMin, pos) => openNewMeeting(date, startMin, endMin, pos)}
              onEventEdit={openEditMeeting}
              onEventCancel={openCancel}
              onEventMove={(m, dateIso, time, end_time) =>
                moveMutation.mutate({ id: m.id, data: { date: dateIso, time, end_time } })}
              onEventResize={(m, end_time) =>
                resizeMutation.mutate({ id: m.id, end_time })}
            />
          </div>
        </div>
      </div>

      {/* ── Event create/edit modal ── */}
      {eventModal && (
        <EventModal
          initial={eventModal}
          pairs={pairs}
          meetings={meetings}
          onSave={(data, id) => id ? updateMutation.mutate({ id, data }) : createMutation.mutate(data)}
          onClose={() => setEventModal(null)}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* ── Cancel / reason modal ── */}
      {reasonModal && (
        <ReasonModal
          meeting={reasonModal.meeting}
          onConfirm={(reason) => cancelMutation.mutate({ id: reasonModal.meeting.id, reason })}
          onClose={() => setReasonModal(null)}
          saving={cancelMutation.isPending}
        />
      )}
    </>
  );
}
