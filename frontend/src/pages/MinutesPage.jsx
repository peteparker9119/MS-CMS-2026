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
import SearchableSelect from '../components/SearchableSelect';

const ERR = { fontSize: 11, color: '#dc2626', marginTop: 4 };
import { downloadPDF, downloadWord } from '../utils/momExport';
import {
  CCard, CCardBody,
  CButton,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea,
  CRow, CCol,
} from '@coreui/react';

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
  if (m.agenda) { lines.push('', '📌 AGENDA', m.agenda); }
  if (mins?.summary) { lines.push('', '📝 SUMMARY', mins.summary); }
  if (mins?.action_points?.length) {
    lines.push('', '✅ ACTION POINTS');
    mins.action_points.forEach(ap => lines.push(`${ap.done ? '☑' : '☐'} ${ap.aid}: ${ap.text}`));
  }
  lines.push('', '──────────────────────────────', 'MS - CMS Convergence — TN EMIS');
  return lines.join('\n');
}

function shareWhatsApp(meeting) {
  window.open('https://wa.me/?text=' + encodeURIComponent(formatMoM(meeting)), '_blank');
}

// ── Record MoM modal ─────────────────────────────────────────────────────────
function RecordModal({ pairs, meetings, formPairs, pocUnit, pairMembers, onClose, onSubmit, saving }) {
  const [selPair,     setSelPair]     = useState('');
  const [mDate,       setMDate]       = useState('');
  const [outcome,     setOutcome]     = useState('held');
  const [attendees,   setAttendees]   = useState('');
  const [summary,     setSummary]     = useState('');
  const [actionItems, setActionItems] = useState([{ text: '', assigned_to: null, deadline: '' }]);
  const [nhStatus,    setNhStatus]    = useState('postponed');
  const [reason,      setReason]      = useState('');
  const [fe,          setFe]          = useState({});

  const clearFe = f => setFe(p => ({ ...p, [f]: '' }));
  const addAP    = () => setActionItems(p => [...p, { text:'', assigned_to:null, deadline:'' }]);
  const removeAP = i  => setActionItems(p => p.filter((_,idx) => idx!==i));
  const updateAP = (i, f, v) => setActionItems(p => p.map((it,idx) => idx===i ? {...it,[f]:v} : it));

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
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
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:1101, width:'min(760px,96vw)', maxHeight:'92vh',
        background:'#fff', borderRadius:16,
        boxShadow:'0 24px 64px rgba(0,0,0,.28)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        fontFamily:'var(--fm)',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 28px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:22, color:'var(--ink)' }}>Record meeting</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)', marginTop:3 }}>held → file minutes · not held → record reason</div>
          </div>
          <button type="button" onClick={onClose}
            style={{ border:'none', background:'none', cursor:'pointer', width:38, height:38, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink2)', fontSize:22, lineHeight:1 }}
            onMouseEnter={e => e.currentTarget.style.background='#f1f3f4'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
          {/* Pair + Date row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div>
              <label style={LBL}>Convergence unit pair</label>
              {pocUnit ? (
                <select value={selPair} onChange={e => { setSelPair(e.target.value); clearFe('selPair'); }}
                  style={{ ...INP, cursor:'pointer' }}
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e  => e.target.style.borderColor='var(--line)'}>
                  <option value="">— Select pair —</option>
                  {formPairs.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.unit_a.slug===pocUnit.slug ? p.unit_b.name : p.unit_a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select value={selPair} onChange={e => { setSelPair(e.target.value); clearFe('selPair'); }}
                  style={{ ...INP, cursor:'pointer' }}
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e  => e.target.style.borderColor='var(--line)'}>
                  <option value="">— Select pair —</option>
                  {formPairs.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.unit_a.abbr} × {p.unit_b.abbr}</option>
                  ))}
                </select>
              )}
              {fe.selPair && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.selPair}</div>}
            </div>
            <div>
              <label style={LBL}>Meeting date</label>
              <DateField value={mDate} onChange={v => { setMDate(v); clearFe('mDate'); }} />
              {fe.mDate && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.mDate}</div>}
            </div>
          </div>

          {/* Outcome toggle */}
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
              {/* Attendees */}
              <div style={{ marginBottom:20 }}>
                <label style={LBL}>Attendees present</label>
                <input style={INP} value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="e.g. 6 of 8 members"
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e  => e.target.style.borderColor='var(--line)'} />
              </div>

              {/* Summary */}
              <div style={{ marginBottom:20 }}>
                <label style={LBL}>Summary / discussion</label>
                <textarea style={{ ...INP, resize:'vertical', minHeight:120, lineHeight:1.6 }}
                  value={summary} onChange={e => { setSummary(e.target.value); clearFe('summary'); }}
                  placeholder="What was discussed and decided…"
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e  => e.target.style.borderColor='var(--line)'} />
                {fe.summary && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.summary}</div>}
              </div>

              {/* Action points */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ ...LBL, margin:0 }}>Action points</label>
                  <button type="button" onClick={addAP}
                    style={{ border:'1.5px solid var(--accent)', borderRadius:8, padding:'5px 14px', background:'var(--accent-light)', color:'var(--accent)', fontFamily:'var(--fb)', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    + Add item
                  </button>
                </div>
                {actionItems.map((item, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 180px 140px 34px', gap:8, marginBottom:10, alignItems:'start' }}>
                    <input style={{ ...INP, fontSize:14 }} value={item.text}
                      onChange={e => updateAP(i,'text',e.target.value)}
                      placeholder={`Action item ${i+1}…`}
                      onFocus={e => e.target.style.borderColor='var(--accent)'}
                      onBlur={e  => e.target.style.borderColor='var(--line)'} />
                    <select style={{ ...INP, cursor:'pointer', fontSize:13 }} value={item.assigned_to??''}
                      onChange={e => updateAP(i,'assigned_to',e.target.value?Number(e.target.value):null)}>
                      <option value="">— Assign to —</option>
                      {pairMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit_abbr})</option>)}
                    </select>
                    <input type="date" value={item.deadline}
                      onChange={e => updateAP(i,'deadline',e.target.value)}
                      style={{ ...INP, fontSize:13, cursor:'pointer' }} />
                    {actionItems.length > 1 ? (
                      <button type="button" onClick={() => removeAP(i)}
                        style={{ height:42, width:34, border:'1px solid #fca5a5', borderRadius:8, background:'#fff5f5', color:'#dc2626', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ×
                      </button>
                    ) : <span />}
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
                      <input type="radio" style={{ display:'none' }} checked={nhStatus===v} onChange={() => setNhStatus(v)} />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={LBL}>Reason — why it didn't happen</label>
                <textarea style={{ ...INP, resize:'vertical', minHeight:120, lineHeight:1.6 }}
                  value={reason} onChange={e => { setReason(e.target.value); clearFe('reason'); }}
                  placeholder="e.g. Key members on field duty; clashed with district review…"
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e  => e.target.style.borderColor='var(--line)'} />
                {fe.reason && <div style={{ fontSize:12, color:'#dc2626', marginTop:5 }}>⚠ {fe.reason}</div>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0, background:'#fff' }}>
          <button type="button" onClick={onClose}
            style={{ border:'1px solid var(--line)', borderRadius:20, padding:'10px 24px', fontSize:14, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--accent)', fontWeight:500 }}
            onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
            onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            style={{ border:'none', borderRadius:20, padding:'10px 32px', fontSize:14, fontFamily:'var(--fb)', fontWeight:600, cursor:saving?'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:saving?.7:1 }}>
            {saving ? 'Saving…' : outcome==='held' ? 'Submit minutes' : 'Record reason'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default function MinutesPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();

  const { data: units = [] } = useQuery({ queryKey:['units'], queryFn: getUnits });
  const { data: pairs = [] } = useQuery({ queryKey:['pairs'], queryFn: getPairs });

  const [curPOC,    setCurPOC]    = useState(user?.unit_slug ?? '');
  const pocUnit = units.find(u => u.slug === (user?.role === 'poc' ? user.unit_slug : curPOC));

  const pocPairs = useMemo(() =>
    pairs.filter(p => p.unit_a.slug === pocUnit?.slug || p.unit_b.slug === pocUnit?.slug),
    [pairs, pocUnit]
  );

  /* Pairs available in the form select:
     - POC: only their own unit's pairs
     - Admin + workspace selected: that workspace's pairs
     - Admin + no workspace: all 21 pairs grouped by unit */
  const formPairs = useMemo(() => {
    if (pocUnit) return pocPairs;
    if (user?.role === 'admin') return pairs;
    return [];
  }, [pocUnit, pocPairs, pairs, user]);

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', pocUnit?.slug],
    queryFn:  () => getMeetings({ unit: pocUnit?.slug }),
    enabled:  !!pocUnit,
  });

  const conductedMeetings = useMemo(() => meetings.filter(m => m.status === 'conducted' && m.minutes), [meetings]);
  const totalActions = conductedMeetings.reduce((s,m) => s + (m.minutes?.action_points?.length ?? 0), 0);
  const lastFiled    = [...conductedMeetings].sort((a,b) => new Date(b.date)-new Date(a.date))[0];

  const [showModal, setShowModal] = useState(false);
  const [modalPair, setModalPair] = useState('');

  const selectedPair = pairs.find(p => String(p.id) === modalPair);
  const { data: pairMembers = [] } = useQuery({
    queryKey: ['pair-members', modalPair],
    queryFn: () => getUsersByUnits([selectedPair.unit_a.id, selectedPair.unit_b.id]),
    enabled: !!selectedPair,
  });

  const submitMutation = useMutation({
    mutationFn: ({ meetingId, data, outcome }) => outcome === 'held' ? submitMinutes(meetingId, data) : recordNotHeld(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries(['meetings']);
      setShowModal(false);
      toast('Saved');
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const handleSubmit = async ({ selPair, mDate, outcome, attendees, summary, apItems, nhStatus, reason }) => {
    const pair = pairs.find(p => String(p.id) === selPair);
    if (!pair) return;
    setModalPair(selPair);
    const existing = meetings.find(m =>
      (m.pair.unit_a.slug === pair.unit_a.slug && m.pair.unit_b.slug === pair.unit_b.slug) ||
      (m.pair.unit_a.slug === pair.unit_b.slug && m.pair.unit_b.slug === pair.unit_a.slug)
    );
    if (outcome === 'held') {
      if (existing) {
        submitMutation.mutate({ meetingId: existing.id, data: { attendees, summary, action_points: apItems, source:'written' }, outcome });
      } else {
        const m = await createMeeting({ pair_id: pair.id, date: mDate, status:'conducted', mtype:'In-person' });
        submitMutation.mutate({ meetingId: m.id, data: { attendees, summary, action_points: apItems, source:'written' }, outcome });
      }
    } else {
      if (existing) {
        submitMutation.mutate({ meetingId: existing.id, data: { status: nhStatus, reason }, outcome });
      } else {
        const m = await createMeeting({ pair_id: pair.id, date: mDate, status: nhStatus, mtype:'In-person' });
        submitMutation.mutate({ meetingId: m.id, data: { status: nhStatus, reason }, outcome });
      }
    }
  };

  return (
    <>
      {/* Header bar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Minutes of meeting</div>
          <div className="v">{pocUnit ? `${pocUnit.name} POC workspace` : 'Select workspace'}</div>
        </div>
        {user?.role === 'admin' && (
          <div className="seg">
            {units.map(u => (
              <button key={u.slug} className={curPOC===u.slug?'on':''} onClick={() => { setCurPOC(u.slug); setSelPair(''); }}>
                <span className="sw" style={{ background:u.color }} />{u.abbr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* POC stats */}
      <CRow className="g-3 mb-3">
        {[
          { hero:true, l:'Workspace',          v: pocUnit?.abbr ?? '—',        sub:`${pocPairs.length} convergence units` },
          { l:'Minutes filed',                  v: conductedMeetings.length,    sub:'by this POC' },
          { l:'Action items logged',            v: totalActions,                sub:'from filed MoMs' },
          { l:'Last filed',                     v: lastFiled?.date?.slice(0,10) ?? '—', sub: lastFiled ? 'most recent' : 'none yet' },
        ].map((c, i) => (
          <CCol key={i} xs={6} md={3}>
            <CCard className={c.hero ? 'stat-hero' : ''}>
              <CCardBody style={{ padding:'18px 20px' }}>
                <div className="stat-label">{c.l}</div>
                <div className="stat-value">{c.v}</div>
                <div className="stat-sub">{c.sub}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* Record modal */}
      {showModal && (
        <RecordModal
          pairs={pairs}
          meetings={meetings}
          formPairs={formPairs}
          pocUnit={pocUnit}
          pairMembers={pairMembers}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          saving={submitMutation.isPending}
        />
      )}

      <CRow className="g-3">
        {/* Filed minutes */}
        <CCol lg={12}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Filed minutes</h5>
                <button type="button" onClick={() => setShowModal(true)}
                  style={{ border:'none', borderRadius:20, padding:'9px 22px', fontSize:14, fontFamily:'var(--fb)', fontWeight:600, cursor:'pointer', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', gap:8, boxShadow:'0 1px 4px rgba(0,0,0,.18)' }}
                  onMouseEnter={e => e.currentTarget.style.background='#1557b0'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--accent)'}>
                  + Record meeting
                </button>
              </div>
              {conductedMeetings.length === 0
                ? <div style={{ fontSize:13, color:'var(--ink3)' }}>No minutes filed yet for this workspace.</div>
                : conductedMeetings.slice(0,15).map(m => {
                    const A = m.pair.unit_a, B = m.pair.unit_b;
                    const apDone  = m.minutes?.action_points?.filter(a => a.done).length ?? 0;
                    const apTotal = m.minutes?.action_points?.length ?? 0;
                    return (
                      <div key={m.id} style={{ border:'1px solid var(--line)', borderRadius:11, padding:'14px 16px', marginBottom:10, background:'#fff' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:18 }}>📝</span>
                            <div>
                              <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:18, display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ width:11, height:11, borderRadius:'50%', background:A.color, display:'inline-block' }} />{A.name}
                                <span style={{ color:'var(--ink3)', fontWeight:400, fontSize:13 }}>×</span>
                                <span style={{ width:11, height:11, borderRadius:'50%', background:B.color, display:'inline-block' }} />{B.name}
                              </div>
                              <div style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink2)', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
                                <span>📅 {m.date}</span>
                                <span style={{ textTransform:'capitalize' }}>{m.minutes?.source === 'upload' ? '📎 Uploaded' : '✍ Written'}</span>
                                {m.minutes?.attendees && <span>👥 {m.minutes.attendees}</span>}
                              </div>
                          </div>
                        </div>
                        {/* Action points list */}
                        {m.minutes?.action_points?.length > 0 && (
                          <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--line2)' }}>
                            {m.minutes.action_points.map((ap, ai) => (
                              <div key={ap.id ?? ai}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', fontSize:13 }}>
                                  <span style={{ width:14, height:14, borderRadius:4, border:`1.5px solid ${ap.done?'var(--ok)':'var(--ink3)'}`, background:ap.done?'var(--ok)':'transparent', flexShrink:0, display:'inline-block' }} />
                                  <span style={{ color:ap.done?'var(--ink3)':'var(--ink)', textDecoration:ap.done?'line-through':'none', flex:1 }}>{ap.text}</span>
                                  {ap.deadline && (() => {
                                    const d = new Date(ap.deadline);
                                    const now = new Date();
                                    const diff = (d - now) / (1000 * 60 * 60 * 24);
                                    const color = diff < 0 ? '#dc2626' : diff <= 3 ? '#f59e0b' : '#059669';
                                    return (
                                      <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:color, borderRadius:4, padding:'1px 6px', marginLeft:6 }}>
                                        {ap.deadline}
                                      </span>
                                    );
                                  })()}
                                  {ap.assigned_to_name && (
                                    <span style={{ fontSize:11, color:'var(--ink3)', marginLeft:6 }}>→ {ap.assigned_to_name}</span>
                                  )}
                                </div>
                                {ap.deadline_history?.length > 0 && (
                                  <div style={{ marginLeft:27, marginTop:4, borderLeft:'2px solid var(--line)', paddingLeft:8 }}>
                                    {ap.deadline_history.map((h, hi) => (
                                      <div key={hi} style={{ fontSize:10, color:'var(--ink3)', marginBottom:2 }}>
                                        {h.changed_at?.slice(0,10)} — deadline changed from {h.old_deadline ?? 'none'} → {h.new_deadline ?? 'none'} by {h.changed_by_name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Action count + share row */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1px solid var(--line2)' }}>
                          <span style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink2)' }}>
                            <b style={{ fontFamily:'var(--fd)', fontSize:15, color:'var(--ink)' }}>{apTotal}</b> action pts &nbsp;·&nbsp; {apDone} closed
                          </span>
                          <div style={{ display:'flex', gap:6 }}>
                            <button type="button" onClick={() => downloadPDF(m)}
                              style={{ border:'1px solid var(--line)', borderRadius:7, padding:'5px 11px', background:'#fff', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink2)' }}>
                              ⬇ PDF
                            </button>
                            <button type="button" onClick={() => downloadWord(m)}
                              style={{ border:'1px solid var(--line)', borderRadius:7, padding:'5px 11px', background:'#fff', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink2)' }}>
                              ⬇ Word
                            </button>
                            {m.minutes?.uploaded_file && (
                              <a href={m.minutes.uploaded_file} download={m.minutes.filename || 'MoM'}
                                style={{ border:'1px solid var(--line)', borderRadius:7, padding:'5px 11px', background:'#fff', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--ink2)', textDecoration:'none' }}>
                                📎 File
                              </a>
                            )}
                            <button type="button" onClick={() => shareWhatsApp(m)} title="Share on WhatsApp"
                              style={{ border:'none', borderRadius:7, padding:'5px 9px', background:'#25d366', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })
              }
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
