import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings, createMeeting, updateMeeting, deleteMeeting } from '../api/meetings';
import { getPairs } from '../api/units';
import { useToast } from '../context/ToastContext';
import Badge from '../components/Badge';
import DateField from '../components/DateField';
import TimeField from '../components/TimeField';
import {
  CCard, CCardBody,
  CButton,
  CFormLabel, CFormSelect, CFormTextarea,
  CRow, CCol,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
} from '@coreui/react';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt      = d => `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
const LBL      = { fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink3)' };

export default function PlannerPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const now = new Date();
  const [calMonth, setCalMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selDay,   setSelDay]   = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  const [schedModalOpen,     setSchedModalOpen]     = useState(false);
  const [reschedModalOpen,   setReschedModalOpen]   = useState(false);
  const [reschedMeeting,     setReschedMeeting]     = useState(null);

  const [fPair,   setFPair]   = useState('');
  const [fDate,   setFDate]   = useState('');
  const [fTime,   setFTime]   = useState('11:00');
  const [fAgenda, setFAgenda] = useState('');
  const [fType,   setFType]   = useState('In-person');
  const [fNotify, setFNotify] = useState([]);

  // Reschedule form fields
  const [rDate,   setRDate]   = useState('');
  const [rTime,   setRTime]   = useState('');
  const [rAgenda, setRAgenda] = useState('');

  const { data: pairs    = [] } = useQuery({ queryKey:['pairs'],    queryFn: getPairs });
  const { data: meetings = [] } = useQuery({ queryKey:['meetings'], queryFn: () => getMeetings({}) });

  const upcoming = useMemo(() =>
    meetings.filter(m => m.status === 'scheduled' && new Date(m.date) >= new Date(now.toDateString()))
      .sort((a,b) => new Date(a.date) - new Date(b.date)),
    [meetings] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const byDay = useMemo(() => {
    const map = {};
    meetings.forEach(m => {
      const d = new Date(m.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] = map[key] || []).push(m);
    });
    return map;
  }, [meetings]);

  const selDayMeetings = useMemo(() => {
    const key = `${selDay.getFullYear()}-${selDay.getMonth()}-${selDay.getDate()}`;
    return byDay[key] || [];
  }, [selDay, byDay]);

  const scheduleMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setFPair(''); setFDate(''); setFTime('11:00'); setFAgenda(''); setFType('In-person'); setFNotify([]);
      setSchedModalOpen(false);
      toast('Meeting scheduled');
    },
    onError: () => toast('Failed to schedule'),
  });

  const cancelMutation = useMutation({
    mutationFn: deleteMeeting,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings'] }); toast('Meeting cancelled'); },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, data }) => updateMeeting(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setReschedModalOpen(false);
      setReschedMeeting(null);
      toast('Meeting rescheduled');
    },
    onError: () => toast('Failed to reschedule'),
  });

  const openReschedule = (m) => {
    setReschedMeeting(m);
    setRDate(m.date);
    setRTime(m.time ?? '');
    setRAgenda(m.agenda ?? '');
    setReschedModalOpen(true);
  };

  const handleReschedule = () => {
    if (!rDate) { toast('Pick a new date'); return; }
    rescheduleMutation.mutate({ id: reschedMeeting.id, data: { date: rDate, time: rTime || null, agenda: rAgenda } });
  };

  const handleSchedule = () => {
    if (!fPair) { toast('Select a convergence unit'); return; }
    if (!fDate) { toast('Pick a date'); return; }
    scheduleMutation.mutate({ pair_id: parseInt(fPair), date: fDate, time: fTime || null, agenda: fAgenda, mtype: fType, notify_unit_ids: fNotify.map(Number) });
  };

  const openScheduleModal = (isoDate) => {
    setFDate(isoDate);
    setSchedModalOpen(true);
  };

  const selectedPairUnits = useMemo(() => {
    if (!fPair) return [];
    const pair = pairs.find(p => p.id === parseInt(fPair));
    return pair ? [pair.unit_a, pair.unit_b] : [];
  }, [fPair, pairs]);

  const year = calMonth.getFullYear(), mo = calMonth.getMonth();
  const first    = new Date(year, mo, 1);
  const startDay = new Date(year, mo, 1 - first.getDay());
  const calDays  = Array.from({ length: 42 }, (_, i) => { const d = new Date(startDay); d.setDate(startDay.getDate() + i); return d; });

  const STATUS_COLOR = { conducted:'#1D9E75', scheduled:'#378ADD', postponed:'#E0A21C', missed:'#D85A30' };

  const todayIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  return (
    <>
      {/* Header bar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Meeting planner</div>
          <div className="v">Schedule &amp; notify across all convergence units</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CButton color="dark" size="sm" onClick={() => openScheduleModal(todayIso)} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
            + Schedule Meeting
          </CButton>
          <CButton color="dark" variant="outline" size="sm" onClick={() => {
            if (!window.Notification) { toast('Not supported'); return; }
            Notification.requestPermission().then(p => toast(p==='granted'?'Browser alerts enabled':'Alerts not enabled'));
          }}>
            🔔 Enable browser alerts
          </CButton>
        </div>
      </div>

      <CRow className="g-3">
        {/* Calendar */}
        <CCol lg={6}>
          <CCard>
            <CCardBody style={{ padding:'18px 20px' }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:22 }}>{MONTHS[mo]} {year}</div>
                <div style={{ display:'inline-flex', gap:3, background:'var(--paper)', border:'1px solid var(--line)', borderRadius:99, padding:3 }}>
                  {[['‹',-1],['·',0],['›',1]].map(([l,n]) => (
                    <button key={l} type="button"
                      onClick={() => n===0 ? setCalMonth(new Date(now.getFullYear(),now.getMonth(),1)) : setCalMonth(new Date(year,mo+n,1))}
                      style={{ border:0, background:'none', fontFamily:'var(--fm)', fontSize: n===0 ? 14 : 22, lineHeight:1, padding: n===0 ? '5px 10px' : '1px 11px', borderRadius:99, cursor:'pointer', color:'var(--ink2)', fontWeight: n===0 ? 400 : 600 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
                {DOW.map(d => (
                  <div key={d} style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, color:'var(--ink3)', textAlign:'center', padding:'6px 0 4px', textTransform:'uppercase', letterSpacing:'.06em' }}>{d}</div>
                ))}
                {calDays.map((d, i) => {
                  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                  const evs = byDay[key] || [];
                  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  const isOther    = d.getMonth() !== mo;
                  const isToday    = d.toDateString() === now.toDateString();
                  const isSelected = d.toDateString() === selDay.toDateString();
                  return (
                    <div key={i}
                      onClick={() => { setSelDay(new Date(d)); setFDate(iso); }}
                      style={{ minHeight:72, border:`1px solid ${isSelected?'var(--accent)':isToday?'var(--info)':'var(--line)'}`, borderRadius:9, padding:'7px 9px', cursor:'pointer', background:isSelected?'var(--accent-light)':isToday?'#f5f7ff':'#fff', display:'flex', flexDirection:'column', gap:4, opacity:isOther?.35:1, transition:'.13s', boxShadow:isSelected?'0 0 0 2px var(--accent)':isToday?'0 0 0 2px var(--info)':'none' }}>
                      <div style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:700, color: isToday?'var(--accent)':isSelected?'var(--accent-dark)':'var(--ink)', lineHeight:1 }}>{d.getDate()}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:3, overflow:'hidden' }}>
                        {evs.slice(0,3).map((m,j) => (
                          <div key={j} style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:STATUS_COLOR[m.status]??'#ccc', flexShrink:0 }} />
                            <span style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, color:'var(--ink2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3 }}>
                              {m.pair.unit_a.abbr}×{m.pair.unit_b.abbr}
                            </span>
                          </div>
                        ))}
                        {evs.length>3 && <span style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, color:'var(--ink3)' }}>+{evs.length-3}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop:18 }}>
                <div style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:8 }}>On {fmt(selDay)}</div>
                {selDayMeetings.length === 0
                  ? <div style={{ fontSize:13, color:'var(--ink3)' }}>Nothing scheduled.</div>
                  : selDayMeetings.map(m => {
                      const A = m.pair.unit_a, B = m.pair.unit_b;
                      return (
                        <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', border:'1px solid var(--line)', borderRadius:9, marginBottom:7, background:'#fff', fontSize:13 }}>
                          <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', minWidth:52 }}>{m.time??''}</span>
                          <Badge status={m.status} />
                          <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <i style={{ width:8, height:8, borderRadius:'50%', background:A.color, display:'inline-block' }} />{A.abbr} ×
                            <i style={{ width:8, height:8, borderRadius:'50%', background:B.color, display:'inline-block' }} />{B.abbr}
                          </span>
                        </div>
                      );
                    })
                }
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Upcoming meetings (right column on desktop) */}
        <CCol lg={6}>
          <CCard style={{ height: '100%' }}>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Upcoming meetings</h5>
                <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)' }}>soonest first</span>
              </div>
              {upcoming.length === 0
                ? <div style={{ fontSize:13, color:'var(--ink3)' }}>No upcoming meetings scheduled yet.</div>
                : upcoming.map(m => {
                    const d = new Date(m.date);
                    const A = m.pair.unit_a, B = m.pair.unit_b;
                    const tg = m.notify_units?.map(u => u.abbr).join(', ') || 'none';
                    return (
                      <div key={m.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center', border:'1px solid var(--line)', borderRadius:12, padding:'14px 16px', marginBottom:10, background:'var(--paper)' }}>
                        <div style={{ textAlign:'center', minWidth:62 }}>
                          <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:22, lineHeight:1 }}>{d.getDate()}</div>
                          <div style={{ fontFamily:'var(--fm)', fontSize:11, textTransform:'uppercase', color:'var(--ink3)' }}>{MONTHS_S[d.getMonth()]}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ width:11, height:11, borderRadius:'50%', background:A.color, display:'inline-block' }} />{A.name}
                            <span style={{ color:'var(--ink3)', fontWeight:400 }}>×</span>
                            <span style={{ width:11, height:11, borderRadius:'50%', background:B.color, display:'inline-block' }} />{B.name}
                          </div>
                          <div style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', marginTop:5, display:'flex', gap:10, flexWrap:'wrap' }}>
                            <span>🕘 {m.time??'—'}</span><span>🔔 {tg}</span>
                          </div>
                          {m.agenda && <div style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', marginTop:4 }}>{m.agenda}</div>}
                        </div>
                        <div className="d-flex flex-column gap-2">
                          <CButton size="sm" color="dark" variant="outline" onClick={() => window.open(`mailto:?subject=MS-CMS Meeting: ${A.abbr} × ${B.abbr} on ${m.date}&body=Date: ${m.date}%0ATime: ${m.time??''}%0AAgenda: ${m.agenda??''}`)}>
                            ✉ Email
                          </CButton>
                          <CButton size="sm" color="dark" variant="outline" onClick={() => openReschedule(m)} style={{ fontFamily:'var(--fb)', fontSize:11 }}>
                            ✎ Reschedule
                          </CButton>
                          <CButton size="sm" color="danger" onClick={() => cancelMutation.mutate(m.id)}>Cancel</CButton>
                        </div>
                      </div>
                    );
                  })
              }
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Reschedule modal */}
      {reschedMeeting && (
        <CModal visible={reschedModalOpen} onClose={() => { setReschedModalOpen(false); setReschedMeeting(null); }} size="md" alignment="center">
          <CModalHeader style={{ borderBottom:'1px solid var(--line)', paddingBottom:14 }}>
            <CModalTitle style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18 }}>
              Reschedule — {reschedMeeting.pair.unit_a.abbr} × {reschedMeeting.pair.unit_b.abbr}
            </CModalTitle>
          </CModalHeader>
          <CModalBody style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:10 }}>
              <div>
                <CFormLabel style={LBL}>New date</CFormLabel>
                <DateField value={rDate} onChange={v => setRDate(v)} />
              </div>
              <div>
                <CFormLabel style={LBL}>Time</CFormLabel>
                <TimeField value={rTime} onChange={setRTime} />
              </div>
            </div>
            <div>
              <CFormLabel style={LBL}>Agenda <span style={{ textTransform:'none', opacity:.6 }}>(optional)</span></CFormLabel>
              <CFormTextarea value={rAgenda} onChange={e => setRAgenda(e.target.value)} placeholder="Updated agenda…" rows={2} style={{ resize:'none' }} />
            </div>
          </CModalBody>
          <CModalFooter style={{ borderTop:'1px solid var(--line)', paddingTop:14 }}>
            <CButton color="secondary" variant="outline" onClick={() => { setReschedModalOpen(false); setReschedMeeting(null); }} style={{ fontFamily:'var(--fb)', fontSize:13 }}>Cancel</CButton>
            <CButton color="dark" onClick={handleReschedule} disabled={rescheduleMutation.isPending} style={{ fontFamily:'var(--fb)', fontSize:13 }}>
              {rescheduleMutation.isPending ? 'Saving…' : 'Save changes'}
            </CButton>
          </CModalFooter>
        </CModal>
      )}

      {/* Schedule meeting modal */}
      <CModal visible={schedModalOpen} onClose={() => setSchedModalOpen(false)} size="md" alignment="center">
        <CModalHeader style={{ borderBottom:'1px solid var(--line)', paddingBottom:14 }}>
          <CModalTitle style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18 }}>Schedule a meeting</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>

          <div>
            <CFormLabel style={LBL}>Convergence unit pair</CFormLabel>
            <CFormSelect value={fPair} onChange={e => { setFPair(e.target.value); setFNotify([]); }}>
              <option value="">— Select a pair —</option>
              {pairs.map(p => <option key={p.id} value={p.id}>{p.unit_a.name} × {p.unit_b.name}</option>)}
            </CFormSelect>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:10 }}>
            <div>
              <CFormLabel style={LBL}>Date</CFormLabel>
              <DateField value={fDate} onChange={v => setFDate(v)} />
            </div>
            <div>
              <CFormLabel style={LBL}>Time</CFormLabel>
              <TimeField value={fTime} onChange={setFTime} />
            </div>
          </div>

          <div>
            <CFormLabel style={LBL}>Meeting type</CFormLabel>
            <div style={{ display:'inline-flex', background:'var(--paper)', border:'1px solid var(--line)', borderRadius:8, padding:3, gap:3 }}>
              {['In-person','Online'].map(t => (
                <button key={t} type="button" onClick={() => setFType(t)}
                  style={{ border:'none', borderRadius:6, padding:'5px 16px', fontSize:13, fontFamily:'var(--fb)', fontWeight:600, cursor:'pointer', transition:'.13s', background:fType===t?'var(--accent)':'transparent', color:fType===t?'#fff':'var(--ink2)' }}>
                  {t==='In-person'?'📍 In-person':'💻 Online'}
                </button>
              ))}
            </div>
          </div>

          {selectedPairUnits.length > 0 && (
            <div>
              <CFormLabel style={LBL}>Notify units</CFormLabel>
              <div style={{ display:'flex', gap:8 }}>
                {selectedPairUnits.map(u => (
                  <label key={u.id} style={{ flex:1, display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', padding:'7px 10px', border:`1px solid ${fNotify.includes(u.id)?'var(--accent)':'var(--line)'}`, borderRadius:8, background:fNotify.includes(u.id)?'var(--accent-light)':'#fff', transition:'.13s' }}>
                    <input type="checkbox" style={{ width:14, height:14, accentColor:'var(--accent)', flexShrink:0 }} checked={fNotify.includes(u.id)}
                      onChange={e => setFNotify(n => e.target.checked ? [...n,u.id] : n.filter(x => x!==u.id))} />
                    <span style={{ width:8, height:8, borderRadius:'50%', background:u.color, display:'inline-block', flexShrink:0 }} />
                    <span style={{ fontWeight:500 }}>{u.abbr}</span>
                    <span style={{ color:'var(--ink3)', fontSize:11, marginLeft:'auto' }}>{u.member_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <CFormLabel style={LBL}>Agenda <span style={{ textTransform:'none', opacity:.6 }}>(optional)</span></CFormLabel>
            <CFormTextarea value={fAgenda} onChange={e => setFAgenda(e.target.value)} placeholder="Purpose / points to cover…" rows={2} style={{ resize:'none' }} />
          </div>

        </CModalBody>
        <CModalFooter style={{ borderTop:'1px solid var(--line)', paddingTop:14 }}>
          <CButton color="secondary" variant="outline" onClick={() => setSchedModalOpen(false)} style={{ fontFamily:'var(--fb)', fontSize:13 }}>Cancel</CButton>
          <CButton color="dark" onClick={handleSchedule} disabled={scheduleMutation.isPending} style={{ fontFamily:'var(--fb)', fontSize:13, background:'#3b5bdb', borderColor:'#3b5bdb' }}>
            {scheduleMutation.isPending ? 'Scheduling…' : 'Schedule meeting'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
}
