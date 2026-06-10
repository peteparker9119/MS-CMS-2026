import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeetings, createMeeting, submitMinutes, recordNotHeld } from '../api/meetings';
import { getUnits, getPairs } from '../api/units';
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

  const [selPair,   setSelPair]   = useState('');
  const [mDate,     setMDate]     = useState('');
  const [outcome,   setOutcome]   = useState('held');
  const [attendees, setAttendees] = useState('');
  const [summary,   setSummary]   = useState('');
  const [actions,   setActions]   = useState('');
  const [nhStatus,  setNhStatus]  = useState('postponed');
  const [reason,    setReason]    = useState('');
  const [fe,        setFe]        = useState({});

  const clearFe = (field) => setFe(p => ({ ...p, [field]: '' }));

  const submitMutation = useMutation({
    mutationFn: ({ meetingId, data }) => outcome === 'held' ? submitMinutes(meetingId, data) : recordNotHeld(meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries(['meetings']);
      setSummary(''); setActions(''); setAttendees(''); setReason(''); setFe({});
      toast(outcome === 'held' ? 'Minutes filed' : 'Recorded');
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const handleSubmit = async () => {
    const errors = {};
    if (!selPair) errors.selPair = 'Select a convergence unit pair';
    if (!mDate)   errors.mDate   = 'Pick a meeting date';
    const apLines = outcome === 'held'
      ? actions.split('\n').map(s => s.replace(/^[-•*\d.)\s]+/,'').trim()).filter(Boolean)
      : [];
    if (outcome === 'held' && !summary && !apLines.length) errors.summary = 'Add a summary or at least one action point';
    if (outcome === 'notheld' && !reason) errors.reason = 'Provide a reason for not holding the meeting';
    if (Object.keys(errors).length) { setFe(errors); return; }
    setFe({});

    const pair = pairs.find(p => String(p.id) === selPair);
    if (!pair) return;
    const existing = meetings.find(m =>
      (m.pair.unit_a.slug === pair.unit_a.slug && m.pair.unit_b.slug === pair.unit_b.slug) ||
      (m.pair.unit_a.slug === pair.unit_b.slug && m.pair.unit_b.slug === pair.unit_a.slug)
    );
    if (outcome === 'held') {
      if (existing) {
        submitMutation.mutate({ meetingId: existing.id, data: { attendees, summary, action_points: apLines, source:'written' } });
      } else {
        const m = await createMeeting({ pair_id: pair.id, date: mDate, status:'conducted', mtype:'In-person' });
        submitMutation.mutate({ meetingId: m.id, data: { attendees, summary, action_points: apLines, source:'written' } });
      }
    } else {
      if (existing) {
        submitMutation.mutate({ meetingId: existing.id, data: { status: nhStatus, reason } });
      } else {
        const m = await createMeeting({ pair_id: pair.id, date: mDate, status: nhStatus, mtype:'In-person' });
        submitMutation.mutate({ meetingId: m.id, data: { status: nhStatus, reason } });
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

      <CRow className="g-3">
        {/* Record form */}
        <CCol lg={6}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Record meeting</h5>
                <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)' }}>held → minutes · not held → reason</span>
              </div>

              <div className="mb-3">
                <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>Convergence unit</CFormLabel>
                {pocUnit ? (
                  <SearchableSelect
                    value={selPair}
                    onChange={v => { setSelPair(v); clearFe('selPair'); }}
                    placeholder="— Select unit pair —"
                    hasError={!!fe.selPair}
                    options={formPairs.map(p => ({
                      value: String(p.id),
                      label: p.unit_a.slug === pocUnit.slug ? p.unit_b.name : p.unit_a.name,
                    }))}
                  />
                ) : (
                  <SearchableSelect
                    value={selPair}
                    onChange={v => { setSelPair(v); clearFe('selPair'); }}
                    placeholder="— Select unit pair —"
                    hasError={!!fe.selPair}
                    groups={units.map(u => {
                      const uPairs = formPairs.filter(p => p.unit_a.slug === u.slug || p.unit_b.slug === u.slug);
                      return {
                        label: u.name,
                        options: uPairs.map(p => ({
                          value: String(p.id),
                          label: p.unit_a.slug === u.slug ? p.unit_b.name : p.unit_a.name,
                        })),
                      };
                    }).filter(g => g.options.length > 0)}
                  />
                )}
                {fe.selPair && <div style={ERR}>⚠ {fe.selPair}</div>}
              </div>

              <CRow className="g-2 mb-3">
                <CCol>
                  <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>Meeting date</CFormLabel>
                  <DateField value={mDate} onChange={v => { setMDate(v); clearFe('mDate'); }}
                    style={fe.mDate ? { borderColor:'#dc2626' } : {}} />
                  {fe.mDate && <div style={ERR}>⚠ {fe.mDate}</div>}
                </CCol>
                <CCol>
                  <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>Outcome</CFormLabel>
                  <div className="d-flex gap-2">
                    {[['held','✅ Held'],['notheld','⚠ Not held']].map(([v,l]) => (
                      <label key={v} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, height:38, border:`1.5px solid ${outcome===v?'var(--accent)':'var(--line)'}`, borderRadius:9, padding:'0 8px', fontSize:13, cursor:'pointer', background:outcome===v?'var(--accent-light)':'#fff', fontWeight:outcome===v?700:500, color:outcome===v?'var(--accent)':'var(--ink2)', transition:'.13s' }}>
                        <input type="radio" name="outcome" style={{ display:'none' }} checked={outcome===v} onChange={() => setOutcome(v)} />{l}
                      </label>
                    ))}
                  </div>
                </CCol>
              </CRow>

              {outcome === 'held' ? (
                <>
                  <div className="mb-3">
                    <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>Attendees present</CFormLabel>
                    <CFormInput value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="e.g. 6 of 8" />
                  </div>
                  <div className="mb-3">
                    <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>Summary / discussion</CFormLabel>
                    <CFormTextarea value={summary} onChange={e => { setSummary(e.target.value); clearFe('summary'); }}
                      placeholder="What was discussed and decided…" rows={3}
                      style={fe.summary ? { borderColor:'#dc2626' } : {}} />
                    {fe.summary && <div style={ERR}>⚠ {fe.summary}</div>}
                  </div>
                  <div className="mb-3">
                    <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>
                      Action points <span style={{ textTransform:'none', color:'var(--ink3)' }}>— one per line</span>
                    </CFormLabel>
                    <CFormTextarea value={actions} onChange={e => { setActions(e.target.value); clearFe('summary'); }}
                      placeholder={'VP to share beneficiary list\nSMC to map overlapping schools\nAlign reporting formats'} rows={4} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>What happened</CFormLabel>
                    <div className="d-flex gap-2">
                      {[['postponed','🕘 Postponed'],['missed','✕ Missed']].map(([v,l]) => (
                        <label key={v} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, height:38, border:`1.5px solid ${nhStatus===v?'var(--warn)':'var(--line)'}`, borderRadius:9, padding:'0 8px', fontSize:13, cursor:'pointer', background:nhStatus===v?'#fef9ec':'#fff', fontWeight:nhStatus===v?700:500, color:nhStatus===v?'#92600a':'var(--ink2)', transition:'.13s' }}>
                          <input type="radio" name="nhstatus" style={{ display:'none' }} checked={nhStatus===v} onChange={() => setNhStatus(v)} />{l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <CFormLabel style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)' }}>
                      Reason <span style={{ textTransform:'none' }}>— why it didn't happen</span>
                    </CFormLabel>
                    <CFormTextarea value={reason} onChange={e => { setReason(e.target.value); clearFe('reason'); }}
                      placeholder="e.g. Key members on field duty; clashed with district review…" rows={3}
                      style={fe.reason ? { borderColor:'#dc2626' } : {}} />
                    {fe.reason && <div style={ERR}>⚠ {fe.reason}</div>}
                  </div>
                </>
              )}

              <CButton color="dark" className="w-100" onClick={handleSubmit} disabled={submitMutation.isPending}
                style={{ background:'#3b5bdb', borderColor:'#3b5bdb', fontFamily:'var(--fb)', fontWeight:600, fontSize:15, padding:'10px' }}>
                {submitMutation.isPending ? 'Saving…' : outcome === 'held' ? 'Submit minutes' : 'Record reason'}
              </CButton>
            </CCardBody>
          </CCard>
        </CCol>

        {/* Filed minutes */}
        <CCol lg={6}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Filed minutes</h5>
                <span style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)' }}>most recent first</span>
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
