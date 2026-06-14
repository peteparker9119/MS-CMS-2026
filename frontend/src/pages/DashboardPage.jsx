import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DateField from '../components/DateField';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboardStats, getDashboardMatrix, getMeetings,
  updateActionPoint, addComment, getMeetingMembers,
} from '../api/meetings';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import KpiCard from '../components/KpiCard';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { CCard, CCardBody, CButton, CRow, CCol, CBadge } from '@coreui/react';

/* ── helpers ── */
const PRESETS = [['all', 'All'], ['30', 'Last 30d'], ['90', 'Last 90d']];

function presetToRange(k) {
  const now = Date.now();
  if (k === '30') return { from: new Date(now - 30 * 864e5).toISOString().slice(0, 10), to: null };
  if (k === '90') return { from: new Date(now - 90 * 864e5).toISOString().slice(0, 10), to: null };
  return { from: null, to: null };
}

function monthLabel(ym) {
  if (!ym) return 'All time';
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m) - 1]} ${y}`;
}

function last13Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

/* ── main component ── */
export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [preset,     setPreset]     = useState('all');
  const [range,      setRange]      = useState({ from: null, to: null });
  const [unitFocus,  setUnitFocus]  = useState('all');
  const [chartMonth, setChartMonth] = useState('');   // '' = all time
  const [selPair,    setSelPair]    = useState(null); // { pair_id, unit_a_slug, unit_b_slug }
  const [modal,      setModal]      = useState(null);

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  /* ── date params (for KPI cards + tiles) ── */
  const dateParams = useMemo(() => {
    const r = preset !== '' ? presetToRange(preset) : range;
    const p = {};
    if (r.from) p.from = r.from;
    if (r.to)   p.to   = r.to;
    return p;
  }, [preset, range]);

  const statsParams = useMemo(() => {
    const p = { ...dateParams };
    if (unitFocus !== 'all') p.unit = unitFocus;
    return p;
  }, [dateParams, unitFocus]);

  /* ── chart params (independent month filter) ── */
  const chartParams = useMemo(() => {
    if (!chartMonth) return {};
    const [y, m] = chartMonth.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      from: `${y}-${m}-01`,
      to:   `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [chartMonth]);

  /* ── queries ── */
  const { data: units = [] }      = useQuery({ queryKey: ['units'], queryFn: getUnits });
  const { data: stats }           = useQuery({ queryKey: ['dash-stats',  statsParams], queryFn: () => getDashboardStats(statsParams) });
  const { data: matrix = [] }     = useQuery({ queryKey: ['dash-matrix', dateParams],  queryFn: () => getDashboardMatrix(dateParams) });
  const { data: chartMatrix = [] }= useQuery({ queryKey: ['dash-matrix', chartParams], queryFn: () => getDashboardMatrix(chartParams) });

  const { data: pairMeetings = [], isLoading: pairLoading } = useQuery({
    queryKey: ['meetings', { pair: selPair?.pair_id, ...dateParams }],
    queryFn:  () => getMeetings({ pair: selPair?.pair_id, ...dateParams }),
    enabled:  !!selPair,
  });

  /* ── action mutations ── */
  const toggleAP = useMutation({
    mutationFn: ({ id }) => updateActionPoint(id, { done: true }),
    onSuccess: () => { qc.invalidateQueries(['meetings']); toast('Action point closed'); },
  });

  /* ── pair tile data (scoped by role) ── */
  const visibleMatrix = useMemo(() => {
    if (isAdmin) return matrix;
    // POC/team: only pairs involving their unit
    const slug = user?.unit_slug;
    if (!slug) return [];
    return matrix.filter(d => d.unit_a === slug || d.unit_b === slug);
  }, [matrix, isAdmin, user]);

  /* ── pair mini stats (from pairMeetings) ── */
  const pairStats = useMemo(() => {
    if (!pairMeetings.length) return null;
    const conducted = pairMeetings.filter(m => m.status === 'conducted').length;
    const moms      = pairMeetings.filter(m => m.minutes).length;
    let aTot = 0, aDone = 0;
    pairMeetings.forEach(m => {
      aTot  += m.action_points_total ?? 0;
      aDone += m.action_points_done  ?? 0;
    });
    return {
      planned:   pairMeetings.length,
      conducted,
      moms,
      a_tot:  aTot,
      a_done: aDone,
      a_pend: aTot - aDone,
    };
  }, [pairMeetings]);

  /* ── handlers ── */
  const handleCustomDate = (field, val) => {
    setPreset('');
    setRange(r => ({ ...r, [field]: val || null }));
  };

  const handleTileClick = (row) => {
    if (selPair?.pair_id === row.pair_id) { setSelPair(null); return; }
    setSelPair({ pair_id: row.pair_id, unit_a_slug: row.unit_a, unit_b_slug: row.unit_b });
    setTimeout(() => document.getElementById('tile-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  /* ── render ── */
  return (
    <>
      {/* ── Filter row ── */}
      <div className="seg" style={{ display: 'flex', alignItems: 'center', marginBottom: 18, flexWrap: 'nowrap', borderRadius: 12, padding: '4px 6px', gap: 2 }}>
        {/* Unit pills — admin/super_admin */}
        {isAdmin && <>
          <button className={unitFocus === 'all' ? 'on' : ''} onClick={() => setUnitFocus('all')}>All teams</button>
          {units.map(u => (
            <button key={u.slug} className={unitFocus === u.slug ? 'on' : ''} onClick={() => setUnitFocus(unitFocus === u.slug ? 'all' : u.slug)}>
              <span className="sw" style={{ background: u.color }} />{u.abbr}
            </button>
          ))}
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '4px 8px', flexShrink: 0 }} />
        </>}

        {/* Date presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
          {PRESETS.map(([k, l]) => (
            <button key={k} className={preset === k ? 'on' : ''} onClick={() => { setPreset(k); setRange({ from: null, to: null }); }}>{l}</button>
          ))}
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '4px 8px', flexShrink: 0 }} />
        </div>

        {/* Custom date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{ width: 106 }}><DateField value={range.from ?? ''} onChange={v => handleCustomDate('from', v)} placeholder="From" portal /></div>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', flexShrink: 0 }}>–</span>
          <div style={{ width: 106 }}><DateField value={range.to ?? ''} onChange={v => handleCustomDate('to', v)} placeholder="To" portal /></div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <CRow className="g-3 mb-4">
        {[
          { label: 'Meetings planned',    value: stats?.planned    ?? '—', delta: unitFocus === 'all' ? 'across all teams' : `team: ${unitFocus}` },
          { label: 'Conducted',           value: stats?.conducted  ?? '—', delta: stats ? `${stats.planned ? Math.round(stats.conducted / stats.planned * 100) : 0}% of planned` : '—' },
          { label: 'MoMs prepared',       value: stats?.moms       ?? '—', delta: 'minutes filed' },
          { label: 'Action items',        value: stats?.a_tot      ?? '—', delta: 'from all MoMs' },
          { label: 'Completed',           value: stats?.a_done     ?? '—', delta: stats ? `${stats.act_pct}% completion rate` : '—', hero: true },
          { label: 'Pending',             value: stats?.a_pend     ?? '—', delta: 'open · awaiting closure', amber: true },
        ].map((card, i) => (
          <CCol key={i} xs={6} sm={4} xl={2}>
            <KpiCard {...card} />
          </CCol>
        ))}
      </CRow>

      {/* ── Team Chart + Convergence Tiles ── */}
      <CRow className="g-3 mb-3">

        {/* Left: Team participation chart */}
        <CCol md={5}>
          <CCard className="h-100">
            <CCardBody>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>Team chart</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>participation rate per team</div>
                </div>
                {/* Month filter */}
                <select
                  value={chartMonth}
                  onChange={e => setChartMonth(e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontFamily: 'var(--fm)', background: '#fff', color: 'var(--ink)', cursor: 'pointer' }}
                >
                  <option value="">All time</option>
                  {last13Months().map(ym => (
                    <option key={ym} value={ym}>{monthLabel(ym)}</option>
                  ))}
                </select>
              </div>

              {units.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center', paddingTop: 24 }}>No teams found.</div>
              ) : units.map(u => {
                const pd   = chartMatrix.filter(d => d.unit_a === u.slug || d.unit_b === u.slug);
                const total = pd.reduce((s, d) => s + d.planned, 0);
                const done  = pd.reduce((s, d) => s + d.conducted, 0);
                const rate  = total ? done / total : 0;
                const focused = unitFocus === u.slug;
                return (
                  <div key={u.slug}
                    onClick={() => isAdmin && setUnitFocus(focused ? 'all' : u.slug)}
                    style={{
                      display: 'grid', gridTemplateColumns: '110px 1fr 56px',
                      gap: 10, alignItems: 'center', padding: '9px 8px',
                      borderRadius: 9, cursor: isAdmin ? 'pointer' : 'default',
                      background: focused ? 'var(--paper)' : 'transparent',
                      boxShadow: focused ? 'inset 3px 0 0 var(--ink)' : 'none',
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, overflow: 'hidden' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: u.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.abbr}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--line2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${rate * 100}%`, background: u.color, borderRadius: 99, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 12, textAlign: 'right', color: 'var(--ink2)' }}>
                      {done}/{total}
                    </div>
                  </div>
                );
              })}

              {chartMonth && (
                <div style={{ marginTop: 14, padding: '8px 10px', background: 'var(--paper)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--fm)', color: 'var(--ink3)' }}>
                  Showing data for <strong>{monthLabel(chartMonth)}</strong>.
                  <button onClick={() => setChartMonth('')} style={{ border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--fm)', marginLeft: 4 }}>Clear</button>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* Right: Convergence unit tiles */}
        <CCol md={7}>
          <CCard className="h-100">
            <CCardBody>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>Convergence units</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>click a tile to view meetings</div>
              </div>

              {visibleMatrix.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center', paddingTop: 32 }}>No convergence pairs found.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {visibleMatrix.map(row => {
                    const uA = units.find(u => u.slug === row.unit_a);
                    const uB = units.find(u => u.slug === row.unit_b);
                    if (!uA || !uB) return null;
                    const rate   = row.planned ? row.conducted / row.planned : 0;
                    const active = selPair?.pair_id === row.pair_id;
                    const rateColor = rate >= 0.8 ? '#059669' : rate >= 0.5 ? '#d97706' : rate > 0 ? '#dc2626' : 'var(--ink3)';
                    return (
                      <div key={row.pair_id}
                        onClick={() => handleTileClick(row)}
                        style={{
                          border: `2px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                          borderRadius: 12, padding: '12px 13px', cursor: 'pointer',
                          background: active ? 'var(--accent-light)' : '#fff',
                          transition: 'border-color .15s, background .15s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--line)'; }}
                      >
                        {/* Pair name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: uA.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>{uA.abbr}</span>
                          <span style={{ fontSize: 10, color: 'var(--ink3)' }}>×</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: uB.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink2)' }}>{uB.abbr}</span>
                        </div>

                        {/* Count */}
                        <div style={{ fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--ink)', marginBottom: 4 }}>
                          {row.planned}
                        </div>
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>meetings planned</div>

                        {/* Progress bar */}
                        <div style={{ height: 5, background: 'var(--line2)', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                          <div style={{ height: '100%', width: `${rate * 100}%`, background: rateColor, borderRadius: 99, transition: 'width .4s' }} />
                        </div>
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 10, color: rateColor, fontWeight: 700 }}>
                          {row.conducted}/{row.planned} conducted
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Tile detail ── */}
      {selPair && (
        <CCard id="tile-detail" className="mb-3">
          <CCardBody>
            {(() => {
              const uA = units.find(u => u.slug === selPair.unit_a_slug);
              const uB = units.find(u => u.slug === selPair.unit_b_slug);
              if (!uA || !uB) return null;

              return (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-.01em' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: uA.color, display: 'inline-block' }} />
                      {uA.name}
                      <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: 16 }}>×</span>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: uB.color, display: 'inline-block' }} />
                      {uB.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CButton
                        size="sm" color="primary" variant="outline"
                        onClick={() => navigate(`/meetings`)}
                        style={{ fontFamily: 'var(--fb)', fontSize: 12 }}
                      >
                        More details →
                      </CButton>
                      <button
                        onClick={() => setSelPair(null)}
                        style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 7, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--ink3)' }}
                      >✕ Close</button>
                    </div>
                  </div>

                  {/* Mini KPI cards */}
                  {pairLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 18 }}>Loading…</div>
                  ) : pairStats && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                      {[
                        ['Planned',    pairStats.planned],
                        ['Conducted',  pairStats.conducted],
                        ['MoMs',       pairStats.moms],
                        ['Action items', pairStats.a_tot],
                        ['Completed',  pairStats.a_done],
                        ['Pending',    pairStats.a_pend],
                      ].map(([l, v]) => (
                        <div key={l} style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: '11px 16px', minWidth: 90 }}>
                          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink3)', marginBottom: 4 }}>{l}</div>
                          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Meeting list */}
                  <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 15, marginBottom: 10, color: 'var(--ink)' }}>Meetings</div>
                  {pairLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Loading meetings…</div>
                  ) : pairMeetings.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--ink3)' }}>No meetings in this period.</div>
                  ) : (
                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                      {/* Table header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px', gap: 0, background: 'var(--paper)', borderBottom: '1px solid var(--line)', padding: '8px 14px' }}>
                        {['Date', 'Meeting between', 'Type', 'Status'].map(h => (
                          <div key={h} style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>{h}</div>
                        ))}
                      </div>
                      {/* Rows */}
                      {pairMeetings.sort((a, b) => new Date(b.date) - new Date(a.date)).map((m, i) => {
                        const A = m.pair.unit_a, B = m.pair.unit_b;
                        return (
                          <div key={m.id}
                            style={{
                              display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px',
                              gap: 0, padding: '10px 14px', alignItems: 'center',
                              borderBottom: i < pairMeetings.length - 1 ? '1px solid var(--line)' : 'none',
                              background: i % 2 === 0 ? '#fff' : 'var(--paper)',
                            }}
                          >
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)' }}>{m.date}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: A.color, flexShrink: 0 }} />
                              {A.abbr}
                              <span style={{ color: 'var(--ink3)', fontSize: 11 }}>×</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: B.color, flexShrink: 0 }} />
                              {B.abbr}
                            </div>
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink2)' }}>
                              {m.mtype ? (m.mtype === 'Online' ? '💻 Online' : '📍 In-person') : '—'}
                            </div>
                            <div><Badge status={m.status} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </CCardBody>
        </CCard>
      )}

      {/* ── Action point modal ── */}
      {modal?.type === 'action-point' && (
        <ActionPointModal
          ap={modal.ap} meeting={modal.meeting}
          onClose={() => setModal(null)}
          onToggle={id => toggleAP.mutate({ id })}
          toast={toast} qc={qc}
        />
      )}
    </>
  );
}

/* ─────────────────── ActionPointModal ─────────────────── */
function ActionPointModal({ ap, meeting, onClose, onToggle, toast, qc }) {
  const [comment,  setComment]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const [assignee, setAssignee] = useState(ap.assigned_to ?? null);
  const [deadline, setDeadline] = useState(ap.deadline ?? '');
  const [saving,   setSaving]   = useState(false);
  const A = meeting.pair.unit_a, B = meeting.pair.unit_b;

  const { data: members = [] } = useQuery({
    queryKey: ['meeting-members', meeting.id],
    queryFn:  () => getMeetingMembers(meeting.id),
  });

  const handleSaveAP = async () => {
    setSaving(true);
    try {
      await updateActionPoint(ap.id, { assigned_to: assignee || null, deadline: deadline || null });
      qc.invalidateQueries(['meetings']);
      toast('Saved');
    } catch { toast('Failed to save'); }
    finally { setSaving(false); }
  };

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
      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel)', padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', lineHeight: 1.35 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: A.color, display: 'inline-block', flexShrink: 0 }} />
            {A.name}
            <span style={{ color: 'var(--ink3)', fontWeight: 400, fontSize: 15 }}>×</span>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: B.color, display: 'inline-block', flexShrink: 0 }} />
            {B.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <CBadge color="success" style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.03em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 99 }}>open action</CBadge>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)' }}>Meeting · {meeting.date}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: 'var(--ink2)', marginTop: 2 }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px 24px' }}>
        <div style={{ background: '#FBF1DC', border: '1px solid #EAC36A', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: '#7a5408', display: 'block', marginBottom: 6 }}>Pending action item</span>
          <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500 }}>{ap.text}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Assign to</div>
            <select value={assignee ?? ''} onChange={e => setAssignee(e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff' }}>
              <option value="">— Unassigned —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit_abbr})</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Deadline</div>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 7, padding: '7px 10px', fontSize: 13 }} />
          </div>
        </div>

        {meeting.minutes?.summary && (
          <>
            <div className="seclab">From the minutes</div>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink2)', marginBottom: 4 }}>{meeting.minutes.summary}</div>
          </>
        )}

        {ap.deadline_history?.length > 0 && (
          <>
            <div className="seclab">Deadline history</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {ap.deadline_history.map((h, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--ink3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--line2)', flexShrink: 0 }} />
                  <span>{h.changed_at?.slice(0, 10)}</span>
                  <span style={{ color: 'var(--ink2)' }}>{h.old_deadline ?? 'none'} → {h.new_deadline ?? 'none'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11 }}>by {h.changed_by_name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {ap.comments?.length > 0 && (
          <>
            <div className="seclab">Comments</div>
            <div className="d-flex flex-column gap-2 mt-2">
              {ap.comments.map((c, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '13px 15px' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: '#fff', fontFamily: 'var(--fm)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MS</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{c.created_by_name || 'Admin'}</span>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto' }}>{c.created_at?.slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink2)' }}>{c.text}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="cbox">
          <textarea placeholder="Add a comment or follow-up…" value={comment} onChange={e => setComment(e.target.value)} />
          <div className="crow">
            <span className="role">Commenting as {meeting.pair?.unit_a?.name ?? 'User'}</span>
            <button disabled={!comment.trim() || posting} onClick={handleComment}>{posting ? 'Posting…' : 'Post comment'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          {!ap.done && (
            <CButton color="dark" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { onToggle(ap.id); onClose(); }}>Mark closed</CButton>
          )}
          <CButton color="primary" onClick={handleSaveAP} disabled={saving} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </CButton>
          <CButton color="dark" variant="outline" onClick={onClose}>Close</CButton>
        </div>
      </div>
    </Modal>
  );
}
