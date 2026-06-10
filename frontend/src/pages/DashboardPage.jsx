import { useState, useMemo } from 'react';
import DateField from '../components/DateField';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDashboardStats, getDashboardMatrix, getMeetings, updateActionPoint, addComment } from '../api/meetings';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import KpiCard from '../components/KpiCard';
import ConvergenceMatrix from '../components/ConvergenceMatrix';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import {
  CCard, CCardBody,
  CButton,
  CRow, CCol,
  CBadge,
} from '@coreui/react';

const PRESETS = [['all','All'],['30','Last 30d'],['90','Last 90d'],['q','This quarter']];

function presetToRange(k) {
  const now = Date.now();
  if (k === '30') return { from: new Date(now - 30*864e5).toISOString().slice(0,10), to: null };
  if (k === '90') return { from: new Date(now - 90*864e5).toISOString().slice(0,10), to: null };
  if (k === 'q')  return { from: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth()/3)*3, 1).toISOString().slice(0,10), to: null };
  return { from: null, to: null };
}

function UnitDotLabel({ unit }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13 }}>
      <i style={{ width:9, height:9, borderRadius:'50%', background:unit.color, display:'inline-block' }} />
      {unit.abbr}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [preset,    setPreset]    = useState('all');
  const [range,     setRange]     = useState({ from:null, to:null });
  const [unitFocus, setUnitFocus] = useState('all');
  const [selPair,   setSelPair]   = useState(null);
  const [modal,     setModal]     = useState(null);

  const params = useMemo(() => {
    const r = preset !== '' ? presetToRange(preset) : range;
    const p = {};
    if (r.from) p.from = r.from;
    if (r.to)   p.to   = r.to;
    if (unitFocus !== 'all') p.unit = unitFocus;
    return p;
  }, [preset, range, unitFocus]);

  const { data: units = [] }   = useQuery({ queryKey:['units'],  queryFn: getUnits });
  const { data: stats }        = useQuery({ queryKey:['stats',   params], queryFn: () => getDashboardStats(params) });
  const { data: matrix = [] }  = useQuery({ queryKey:['matrix',  params], queryFn: () => getDashboardMatrix(params) });
  const { data: meetings = [] }= useQuery({ queryKey:['meetings',params], queryFn: () => getMeetings(params) });

  const pendingAPs = useMemo(() => {
    const out = [];
    meetings.forEach(m => {
      if (m.status === 'conducted' && m.minutes?.action_points) {
        m.minutes.action_points.forEach(ap => { if (!ap.done) out.push({ ap, meeting: m }); });
      }
    });
    return out.slice(0, 20);
  }, [meetings]);

  const toggleAP = useMutation({
    mutationFn: ({ id }) => updateActionPoint(id, { done: true }),
    onSuccess: () => { qc.invalidateQueries(['meetings']); toast('Action point closed'); },
  });

  const selPairMeetings = useMemo(() => {
    if (!selPair) return [];
    return meetings.filter(m =>
      (m.pair.unit_a.slug === selPair.unit_a && m.pair.unit_b.slug === selPair.unit_b) ||
      (m.pair.unit_a.slug === selPair.unit_b && m.pair.unit_b.slug === selPair.unit_a)
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selPair, meetings]);

  const handleCustom = (field, val) => {
    setPreset('');
    setRange(r => ({ ...r, [field]: val || null }));
  };

  return (
    <>
      {/* Single filter row */}
      <div className="seg" style={{ display:'flex', alignItems:'center', marginBottom:18, flexWrap:'wrap', borderRadius:12, padding:'4px 6px' }}>
        {/* Unit pills (admin only) */}
        {user?.role === 'admin' && <>
          <button className={unitFocus==='all'?'on':''} onClick={() => setUnitFocus('all')}>All units</button>
          {units.map(u => (
            <button key={u.slug} className={unitFocus===u.slug?'on':''} onClick={() => setUnitFocus(unitFocus===u.slug?'all':u.slug)}>
              <span className="sw" style={{ background:u.color }} />{u.abbr}
            </button>
          ))}
          {/* Divider */}
          <span style={{ width:1, alignSelf:'stretch', background:'var(--line)', margin:'4px 8px', flexShrink:0 }} />
        </>}

        {/* Period presets */}
        {PRESETS.map(([k,l]) => (
          <button key={k} className={preset===k?'on':''} onClick={() => { setPreset(k); setRange({from:null,to:null}); }}>{l}</button>
        ))}

        {/* Divider */}
        <span style={{ width:1, alignSelf:'stretch', background:'var(--line)', margin:'4px 8px', flexShrink:0 }} />

        {/* Custom date range */}
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <div style={{ width:106 }}><DateField value={range.from ?? ''} onChange={v => handleCustom('from', v)} placeholder="From" portal /></div>
          <span style={{ fontFamily:'var(--fm)', fontSize:12, color:'var(--ink3)', flexShrink:0 }}>–</span>
          <div style={{ width:106 }}><DateField value={range.to ?? ''} onChange={v => handleCustom('to', v)} placeholder="To" portal /></div>
        </div>
      </div>

      {/* KPI cards */}
      <CRow className="g-3 mb-3">
        {[
          { label:'Meetings planned', value:stats?.planned??'—',   delta:`across ${unitFocus==='all'?'all pairs':unitFocus}` },
          { label:'Conducted',        value:stats?.conducted??'—', delta:stats?`${stats.planned ? Math.round(stats.conducted/stats.planned*100) : 0}% of planned held`:'—' },
          { label:'MoMs prepared',    value:stats?.moms??'—',      delta:'one per conducted meeting' },
          { label:'Action items',     value:stats?.a_tot??'—',     delta:'derived from all MoMs' },
          { label:'Pending',          value:stats?.a_pend??'—',    delta:'open · awaiting closure', amber:true },
          { label:'Closed %',         value:stats ? `${stats.act_pct}%` : '—', delta:stats ? `${stats.a_done} closed · ${stats.a_pend} open` : '—', hero:true },
        ].map((card, i) => (
          <CCol key={i} xs={6} sm={4} xl={2}>
            <KpiCard {...card} />
          </CCol>
        ))}
      </CRow>

      {/* Pending action items */}
      {pendingAPs.length > 0 && (
        <CCard className="mb-3" style={{ background:'#FBF1DC', borderColor:'#EAC36A' }}>
          <CCardBody>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:22, color:'#7a5408', margin:0 }}>Pending action items</h5>
              <CBadge color="danger" style={{ borderRadius:99, padding:'5px 13px', fontSize:13 }}>{pendingAPs.length}</CBadge>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:300, overflowY:'auto' }}>
              {pendingAPs.map(({ ap, meeting }) => {
                const A = meeting.pair.unit_a, B = meeting.pair.unit_b;
                return (
                  <div key={ap.id}
                    style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'center', background:'#fff', border:'1px solid #EAD7A6', borderRadius:10, padding:'11px 14px', cursor:'pointer' }}
                    onClick={() => setModal({ type:'action-point', ap, meeting })}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:'var(--bad)', display:'inline-block' }} />
                    <div>
                      <div style={{ fontSize:15 }}>{ap.text}</div>
                      <div style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)', marginTop:3, display:'flex', gap:7 }}>
                        <UnitDotLabel unit={A} /> × <UnitDotLabel unit={B} /> · {meeting.date}
                      </div>
                    </div>
                    <span style={{ color:'var(--ink3)', fontSize:18 }}>›</span>
                  </div>
                );
              })}
            </div>
          </CCardBody>
        </CCard>
      )}

      {/* Programme bars + Matrix */}
      <CRow className="g-3 mb-3">
        <CCol md={5}>
          <CCard className="h-100">
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:22, margin:0 }}>By programme</h5>
                <span style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)' }}>participation in period</span>
              </div>
              <p style={{ fontSize:15, lineHeight:1.55, color:'var(--ink2)', marginBottom:16 }}>
                Participation rate per unit across all its pairings. Click a unit to focus.
              </p>
              {units.map(u => {
                const pd = matrix.filter(d => d.unit_a === u.slug || d.unit_b === u.slug);
                const total = pd.reduce((s,d) => s+d.planned,0);
                const done  = pd.reduce((s,d) => s+d.conducted,0);
                const rate  = total ? done/total : 0;
                const focused = unitFocus === u.slug;
                return (
                  <div key={u.slug} onClick={() => setUnitFocus(focused?'all':u.slug)}
                    style={{ display:'grid', gridTemplateColumns:'106px 1fr 60px', gap:11, alignItems:'center', padding:'9px', borderRadius:9, cursor:'pointer', background:focused?'var(--paper)':'transparent', boxShadow:focused?'inset 3px 0 0 var(--ink)':'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:500 }}>
                      <span style={{ width:10, height:10, borderRadius:'50%', background:u.color, flexShrink:0 }} />{u.abbr}
                    </div>
                    <div style={{ height:9, background:'var(--line2)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${rate*100}%`, background:u.color, borderRadius:99, transition:'width .5s' }} />
                    </div>
                    <div style={{ fontFamily:'var(--fm)', fontSize:13, textAlign:'right', color:'var(--ink2)' }}>{done}/{total}</div>
                  </div>
                );
              })}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={7}>
          <CCard className="h-100">
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:22, margin:0 }}>Convergence units</h5>
                <span style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)' }}>conducted ÷ planned</span>
              </div>
              <p style={{ fontSize:15, lineHeight:1.55, color:'var(--ink2)', marginBottom:16 }}>
                Each cell is a unit-pair. Greener = more consistent. Click a cell to see its meetings below.
              </p>
              <ConvergenceMatrix
                units={units} matrixData={matrix} selectedPair={selPair}
                onSelect={d => { setSelPair(d); setTimeout(() => document.getElementById('detail')?.scrollIntoView({ behavior:'smooth', block:'start' }), 60); }}
              />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Pair detail */}
      {selPair && (
        <CCard id="detail" className="mb-3">
          <CCardBody>
            {(() => {
              const A = units.find(u => u.slug === selPair.unit_a);
              const B = units.find(u => u.slug === selPair.unit_b);
              if (!A || !B) return null;
              const apDone  = selPairMeetings.reduce((s,m) => s+(m.action_points_done??0),0);
              const apTotal = selPairMeetings.reduce((s,m) => s+(m.action_points_total??0),0);
              return (
                <>
                  <div style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:22, display:'flex', alignItems:'center', gap:11, flexWrap:'wrap', letterSpacing:'-.01em', marginBottom:16 }}>
                    <span style={{ width:13, height:13, borderRadius:'50%', background:A.color, display:'inline-block' }} />
                    {A.name}<span style={{ color:'var(--ink3)', fontWeight:400, fontSize:18 }}>×</span>
                    <span style={{ width:13, height:13, borderRadius:'50%', background:B.color, display:'inline-block' }} />
                    {B.name}
                  </div>
                  <div className="d-flex gap-2 flex-wrap mb-4">
                    {[['Planned',selPairMeetings.length],['Conducted',selPairMeetings.filter(m=>m.status==='conducted').length],['MoMs',selPairMeetings.filter(m=>m.status==='conducted').length],['Action items',apTotal],['Pending',apTotal-apDone],['Closed %',apTotal?`${Math.round(apDone/apTotal*100)}%`:'—']].map(([l,v]) => (
                      <div key={l} style={{ background:'var(--paper)', border:'1px solid var(--line)', borderRadius:10, padding:'13px 17px', minWidth:100 }}>
                        <div style={{ fontFamily:'var(--fm)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--ink3)' }}>{l}</div>
                        <div style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:22, lineHeight:1.1, marginTop:4 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Meetings &amp; minutes</h5>
                    <span style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)' }}>newest first · click to expand</span>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {selPairMeetings.length === 0 && <div style={{ fontSize:15, color:'var(--ink3)' }}>No meetings in this period.</div>}
                    {selPairMeetings.map((m, idx) => (
                      <MeetingCard key={m.id} meeting={m} defaultOpen={idx===0} onAPClick={ap => setModal({ type:'action-point', ap, meeting:m })} />
                    ))}
                  </div>
                </>
              );
            })()}
          </CCardBody>
        </CCard>
      )}

      {/* Action point modal */}
      {modal?.type === 'action-point' && (
        <ActionPointModal
          ap={modal.ap} meeting={modal.meeting}
          onClose={() => setModal(null)}
          onToggle={(id) => toggleAP.mutate({ id })}
          toast={toast} qc={qc}
        />
      )}
    </>
  );
}

function MeetingCard({ meeting: m, defaultOpen, onAPClick }) {
  const [open, setOpen] = useState(defaultOpen);
  const apDone  = m.action_points_done  ?? 0;
  const apTotal = m.action_points_total ?? 0;
  const aggLabel = m.status === 'conducted' ? `${apDone}/${apTotal} actions` : m.status === 'scheduled' ? m.time ?? '' : '';

  return (
    <div className={`meet${open?' open':''}`}>
      <div className="mh" onClick={() => setOpen(o => !o)}>
        <span className="date">{m.date}</span>
        <Badge status={m.status} />
        {m.mtype && <span className="mtypechip">{m.mtype==='Online'?'💻':'📍'} {m.mtype}</span>}
        <span className="agg">{aggLabel}</span>
        <span className="chev">›</span>
      </div>
      {open && (
        <div className="mbody">
          {m.status === 'conducted' && m.minutes && (
            <>
              <div style={{ fontSize:15, lineHeight:1.6, color:'var(--ink2)', margin:'14px 0 2px' }}>
                <span style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 }}>Minutes of meeting</span>
                {m.minutes.summary}
              </div>
              {m.minutes.action_points?.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)' }}>Action points</span>
                    <span style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink2)' }}>{apDone}/{apTotal} closed</span>
                  </div>
                  <div style={{ height:7, background:'var(--line2)', borderRadius:99, overflow:'hidden', marginBottom:13 }}>
                    <div style={{ height:'100%', width:`${apTotal?apDone/apTotal*100:0}%`, background:'var(--ok)', borderRadius:99 }} />
                  </div>
                  {m.minutes.action_points.map(ap => (
                    <div key={ap.id} onClick={() => onAPClick(ap)}
                      style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'7px 4px', fontSize:15, cursor:'pointer', borderRadius:7 }}>
                      <span style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${ap.done?'var(--ok)':'var(--ink3)'}`, background:ap.done?'var(--ok)':'transparent', flexShrink:0, marginTop:2, position:'relative', display:'inline-block' }}>
                        {ap.done && <span style={{ position:'absolute', left:4.5, top:1.5, width:4, height:8, border:'solid #fff', borderWidth:'0 2px 2px 0', transform:'rotate(45deg)', display:'block' }} />}
                      </span>
                      <span style={{ color:ap.done?'var(--ink3)':'var(--ink)', textDecoration:ap.done?'line-through':'none' }}>{ap.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {(m.status === 'postponed' || m.status === 'missed') && m.not_held && (
            <div style={{ fontSize:15, lineHeight:1.55, color:'var(--ink2)', marginTop:14 }}>
              <span style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--bad)', display:'block', marginBottom:6 }}>{m.status} — reason</span>
              {m.not_held.reason}
            </div>
          )}
          {m.status === 'scheduled' && (
            <div style={{ paddingTop:14, fontSize:15, color:'var(--ink2)' }}>
              <span style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:5 }}>Agenda</span>
              {m.agenda || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionPointModal({ ap, meeting, onClose, onToggle, toast, qc }) {
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const A = meeting.pair.unit_a, B = meeting.pair.unit_b;

  const handleComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await addComment(ap.id, comment.trim());
      qc.invalidateQueries(['meetings']);
      setComment('');
      toast('Comment posted');
    } finally { setPosting(false); }
  };

  return (
    <Modal onClose={onClose}>
      {/* ── Sticky header ── */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--panel)',
        padding:'20px 24px 16px',
        borderBottom:'1px solid var(--line)',
        display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14,
      }}>
        <div>
          <div style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', lineHeight:1.35 }}>
            <span style={{ width:10, height:10, borderRadius:'50%', background:A.color, display:'inline-block', flexShrink:0 }} />
            {A.name}
            <span style={{ color:'var(--ink3)', fontWeight:400, fontSize:15 }}>×</span>
            <span style={{ width:10, height:10, borderRadius:'50%', background:B.color, display:'inline-block', flexShrink:0 }} />
            {B.name}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
            <CBadge color="success" style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.03em', textTransform:'uppercase', padding:'4px 10px', borderRadius:99 }}>open action</CBadge>
            <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)' }}>Meeting · {meeting.date}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            flexShrink:0, width:32, height:32, borderRadius:'50%',
            border:'1px solid var(--line)', background:'var(--paper)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', fontSize:15, color:'var(--ink2)', marginTop:2,
          }}
        >✕</button>
      </div>

      {/* ── Body ── */}
      <div style={{ padding:'20px 24px 24px' }}>
        {/* Pending action item card */}
        <div style={{ background:'#FBF1DC', border:'1px solid #EAC36A', borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
          <span style={{ fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'#7a5408', display:'block', marginBottom:6 }}>Pending action item</span>
          <div style={{ fontSize:15, lineHeight:1.45, fontWeight:500 }}>{ap.text}</div>
        </div>

        {/* From the minutes */}
        {meeting.minutes?.summary && (
          <>
            <div className="seclab">From the minutes</div>
            <div style={{ fontSize:15, lineHeight:1.6, color:'var(--ink2)', marginBottom:4 }}>{meeting.minutes.summary}</div>
          </>
        )}

        {/* Comments */}
        {ap.comments?.length > 0 && (
          <>
            <div className="seclab">Comments</div>
            <div className="d-flex flex-column gap-2 mt-2">
              {ap.comments.map((c, i) => (
                <div key={i} style={{ background:'#fff', border:'1px solid var(--line)', borderRadius:10, padding:'13px 15px' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ width:26, height:26, borderRadius:'50%', background:'var(--ink)', color:'#fff', fontFamily:'var(--fm)', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>MS</span>
                    <span style={{ fontSize:15, fontWeight:600 }}>{c.created_by_name || 'Admin'}</span>
                    <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', marginLeft:'auto' }}>{c.created_at?.slice(0,10)}</span>
                  </div>
                  <div style={{ fontSize:15, lineHeight:1.5, color:'var(--ink2)' }}>{c.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Comment input */}
        <div className="cbox">
          <textarea placeholder="Add a comment or follow-up…" value={comment} onChange={e => setComment(e.target.value)} />
          <div className="crow">
            <span className="role">Commenting as {meeting.pair?.unit_a?.name ?? 'User'}</span>
            <button disabled={!comment.trim() || posting} onClick={handleComment}>{posting ? 'Posting…' : 'Post comment'}</button>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display:'flex', gap:10, marginTop:20, paddingTop:16, borderTop:'1px solid var(--line)' }}>
          {!ap.done && (
            <CButton color="dark" style={{ flex:1, justifyContent:'center' }} onClick={() => { onToggle(ap.id); onClose(); }}>Mark closed</CButton>
          )}
          <CButton color="dark" variant="outline" onClick={onClose}>Close</CButton>
        </div>
      </div>
    </Modal>
  );
}
