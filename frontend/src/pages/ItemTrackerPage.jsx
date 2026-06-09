import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getItems, createItem, updateItem, setItemStatus,
  addActionItem, toggleActionItem,
  getUsersByUnits,
} from '../api/items';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

const ERR = { fontSize: 11, color: '#dc2626', marginTop: 4 };
import Modal from '../components/Modal';
import DateField from '../components/DateField';
import {
  CCard, CCardBody, CButton, CFormLabel, CFormInput,
  CFormSelect, CFormTextarea, CRow, CCol, CBadge,
} from '@coreui/react';

const ITEM_TYPES = [
  { v:'support',   code:'SU', label:'Support',   color:'#378ADD' },
  { v:'request',   code:'RQ', label:'Request',   color:'#7F77DD' },
  { v:'alert',     code:'AL', label:'Alert',     color:'#E0A21C' },
  { v:'emergency', code:'EM', label:'Emergency', color:'#D85A30' },
  { v:'need',      code:'NE', label:'Need',      color:'#1D9E75' },
  { v:'fund',      code:'FU', label:'Fund',      color:'#16A085' },
  { v:'infra',     code:'IN', label:'Infra',     color:'#8E7CC3' },
  { v:'school',    code:'SC', label:'School',    color:'#D4537E' },
  { v:'student',   code:'ST', label:'Student',   color:'#C0392B' },
];
const typeByValue = Object.fromEntries(ITEM_TYPES.map(t => [t.v, t]));

function slaInfo(sla_end) {
  if (!sla_end) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(sla_end + 'T00:00:00');
  const diff  = Math.floor((end - today) / 86400000);
  if (diff < 0)   return { label:`Breached ${Math.abs(diff)}d ago`, color:'#dc2626', bg:'#fef2f2', border:'#fca5a5', status:'breached' };
  if (diff === 0) return { label:'SLA ends today',                  color:'#b45309', bg:'#fef9c3', border:'#fcd34d', status:'due_today' };
  if (diff <= 3)  return { label:`SLA ends in ${diff}d`,            color:'#92400e', bg:'#fef3c7', border:'#fbbf24', status:'warning'  };
  return              { label:`SLA until ${sla_end}`,           color:'#0369a1', bg:'#e0f2fe', border:'#7dd3fc', status:'ok'      };
}

const LBL = {
  fontFamily:'var(--fm)', fontSize:11, letterSpacing:'.05em',
  textTransform:'uppercase', color:'var(--ink3)', marginBottom:8,
};

/* ── WhatsApp share helper ───────────────────────────────── */
function buildWhatsAppUrl(item) {
  const t    = typeByValue[item.type] ?? ITEM_TYPES[0];
  const tg   = (item.targets ?? []).map(u => u.name).join(', ');
  const sla  = item.sla_end ? `\nSLA End: ${item.sla_end}` : '';
  const asgn = item.assigned_to_name ? `\nAssigned To: ${item.assigned_to_name}` : '';
  const msg  = [
    `📋 *MS-CMS Item: ${item.item_id}*`,
    `Type: ${t.label} | Priority: ${item.priority}`,
    `Title: ${item.title}`,
    `Raised by: ${item.raiser?.name ?? '—'} → ${tg}`,
    item.description ? `\n${item.description}` : '',
    sla, asgn,
    `\nStatus: ${item.status?.toUpperCase()}`,
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

/* ── SLA metric helpers ──────────────────────────────────── */
const SLA_PALETTE = {
  not_started: { color:'#64748b', bg:'#f1f5f9', border:'#e2e8f0', bar:'#94a3b8', label:'Not started' },
  on_track:    { color:'#166534', bg:'#dcfce7', border:'#86efac', bar:'#22c55e', label:'On track'    },
  warning:     { color:'#92400e', bg:'#fef3c7', border:'#fbbf24', bar:'#f59e0b', label:'Warning'     },
  due_today:   { color:'#b45309', bg:'#fef9c3', border:'#fcd34d', bar:'#eab308', label:'Due today'   },
  breached:    { color:'#991b1b', bg:'#fef2f2', border:'#fca5a5', bar:'#ef4444', label:'Breached'    },
};

/* Compact chip used in the item list row */
function SLAChip({ item }) {
  const m = item.sla_metrics;
  if (!m && !item.sla_end) return null;
  const pal = SLA_PALETTE[m?.status] ?? SLA_PALETTE.not_started;
  const label = m
    ? m.status === 'breached'
      ? `SLA ${m.overdue_days}d overdue`
      : m.status === 'not_started'
      ? `SLA starts ${item.sla_start}`
      : `SLA ${m.remaining_days}d left`
    : slaInfo(item.sla_end)?.label ?? '';
  return (
    <span style={{
      fontSize:11, padding:'2px 8px', borderRadius:99,
      background:pal.bg, color:pal.color, border:`1px solid ${pal.border}`,
      fontWeight:600, display:'inline-flex', alignItems:'center', gap:4,
    }}>
      🎯 {label}
      {m && <span style={{ opacity:.55, fontWeight:400 }}>{m.progress_pct}%</span>}
    </span>
  );
}

/* Full SLA progress card used inside the modal */
function SLACard({ item }) {
  const m   = item.sla_metrics;
  const pal = SLA_PALETTE[m?.status ?? 'not_started'];

  if (!item.sla_start && !item.sla_end) return (
    <div style={{ fontSize:13, color:'var(--ink3)', fontStyle:'italic' }}>No SLA set</div>
  );

  return (
    <div style={{ background:pal.bg, border:`1px solid ${pal.border}`, borderRadius:12, padding:'14px 16px' }}>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'var(--fb)', fontWeight:700, fontSize:13, color:pal.color }}>
            🎯 {pal.label}
          </span>
          {m && (
            <span style={{ fontFamily:'var(--fm)', fontSize:11, color:pal.color, opacity:.8 }}>
              {m.progress_pct}% elapsed
            </span>
          )}
        </div>
        <span style={{ fontFamily:'var(--fm)', fontSize:11, color:pal.color }}>
          {item.sla_start} → {item.sla_end}
        </span>
      </div>

      {/* Progress bar */}
      {m && (
        <div style={{ marginBottom:10 }}>
          <div style={{ height:6, background:'rgba(0,0,0,.08)', borderRadius:99, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:99,
              width:`${Math.min(100, m.progress_pct)}%`,
              background: pal.bar,
              transition:'width .3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Stats row */}
      {m && (
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {[
            { label:'Total',     value:`${m.total_days}d`                                     },
            { label:'Elapsed',   value:`${m.elapsed_days}d`                                   },
            m.status === 'breached'
              ? { label:'Overdue',   value:`${m.overdue_days}d`, hi: true }
              : { label:'Remaining', value:`${m.remaining_days}d`         },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:48 }}>
              <span style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:16,
                color: s.hi ? pal.color : 'var(--ink)', lineHeight:1 }}>{s.value}</span>
              <span style={{ fontFamily:'var(--fm)', fontSize:10, color:pal.color,
                textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Only end date provided (no start) */}
      {!m && item.sla_end && (
        <div style={{ fontSize:13, color:pal.color }}>
          End date: {item.sla_end}
          {slaInfo(item.sla_end) && <span style={{ marginLeft:8, fontWeight:600 }}>{slaInfo(item.sla_end).label}</span>}
        </div>
      )}
    </div>
  );
}

export default function ItemTrackerPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();

  const [filter, setFilter] = useState('all');
  const [modal,  setModal]  = useState(null);

  // Create form state
  const [fType,     setFType]     = useState('support');
  const [fTitle,    setFTitle]    = useState('');
  const [fDesc,     setFDesc]     = useState('');
  const [fPrio,     setFPrio]     = useState('Normal');
  const [fTargets,  setFTargets]  = useState([]);
  const [fSlaStart, setFSlaStart] = useState('');
  const [fSlaEnd,   setFSlaEnd]   = useState('');
  const [fAssignTo, setFAssignTo] = useState('');
  const [fe,        setFe]        = useState({});
  const [createdItem, setCreatedItem] = useState(null); // for WhatsApp share

  const { data: units = [] } = useQuery({ queryKey:['units'], queryFn: getUnits });
  const { data: items = [] } = useQuery({
    queryKey: ['items', filter],
    queryFn:  () => getItems(filter !== 'all' ? { status: filter } : {}),
  });

  // Fetch assignable users whenever target units change
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['users-by-units', fTargets],
    queryFn:  () => fTargets.length ? getUsersByUnits(fTargets) : Promise.resolve([]),
    enabled:  fTargets.length > 0,
  });

  const raisedByUnit    = user?.role === 'poc' ? units.find(u => u.slug === user.unit_slug) : null;
  const targetableUnits = useMemo(() => user?.role === 'poc' ? units.filter(u => u.slug !== user.unit_slug) : units, [units, user]);
  const curType         = typeByValue[fType] ?? ITEM_TYPES[0];

  // Clear assign-to if the user's unit is no longer in targets
  useEffect(() => {
    if (!fAssignTo) return;
    const userStillValid = assignableUsers.some(u => String(u.id) === String(fAssignTo));
    if (!userStillValid) setFAssignTo('');
  }, [assignableUsers]);

  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess: (item) => {
      qc.invalidateQueries(['items']);
      setFTitle(''); setFDesc(''); setFTargets([]);
      setFSlaStart(''); setFSlaEnd(''); setFAssignTo(''); setFe({});
      setCreatedItem(item);
      toast(`${item.item_id} created`);
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setItemStatus(id, status),
    onSuccess: () => { qc.invalidateQueries(['items']); toast('Status updated'); },
    onError: (err) => toast(getErrorMessage(err)),
  });
  const aiMutation = useMutation({
    mutationFn: ({ id, text }) => addActionItem(id, text),
    onSuccess: (ai) => { qc.invalidateQueries(['items']); toast(`${ai.aid} added`); },
    onError: (err) => toast(getErrorMessage(err)),
  });
  const toggleAiMutation = useMutation({
    mutationFn: ({ itemId, aiId }) => toggleActionItem(itemId, aiId),
    onSuccess: () => qc.invalidateQueries(['items']),
    onError: (err) => toast(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateItem(id, data),
    onSuccess: () => { qc.invalidateQueries(['items']); toast('Item updated'); },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const handleCreate = () => {
    const errors = {};
    if (!fTitle.trim())   errors.fTitle   = 'Item title is required';
    if (!fTargets.length) errors.fTargets = 'Select at least one target unit';
    if (Object.keys(errors).length) { setFe(errors); return; }
    setFe({});
    const raiserUnit = raisedByUnit ?? units[0];
    if (!raiserUnit) return;
    createMutation.mutate({
      type:fType, title:fTitle.trim(), description:fDesc.trim(),
      priority:fPrio, raiser_id:raiserUnit.id, target_ids:fTargets,
      sla_start: fSlaStart || null,
      sla_end:   fSlaEnd   || null,
      assigned_to_id: fAssignTo ? Number(fAssignTo) : null,
    });
  };

  const buildEmail = (item) => {
    const t  = typeByValue[item.type] ?? ITEM_TYPES[0];
    const tg = item.targets.map(u => u.name).join(', ');
    const subject = encodeURIComponent(`[MS-CMS] ${item.item_id} — ${item.title}`);
    const body    = encodeURIComponent(`TN EMIS — MS-CMS\nType: ${t.label}\nItem: ${item.item_id}\nRaised by: ${item.raiser.name}\nTo: ${tg}\n\n${item.description||''}`);
    return `mailto:?subject=${subject}&body=${body}`;
  };

  const STAT_COLOR = { open:'info', pending:'warning', closed:'success' };

  return (
    <>
      {/* Filter bar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Item tracker</div>
          <div className="v">{raisedByUnit ? `${raisedByUnit.name} — items raised` : 'Create & track items'}</div>
        </div>
        <div className="seg">
          {['all','open','pending','closed'].map(s => (
            <button key={s} className={filter===s?'on':''} onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Post-create WhatsApp banner */}
      {createdItem && (
        <div style={{
          background:'#dcfce7', border:'1px solid #86efac', borderRadius:12,
          padding:'12px 18px', marginBottom:16,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontFamily:'var(--fb)', fontWeight:700, fontSize:14, color:'#166534' }}>
                {createdItem.item_id} created
              </div>
              <div style={{ fontFamily:'var(--fm)', fontSize:12, color:'#166534', opacity:.8 }}>
                Share this item via WhatsApp?
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => window.open(buildWhatsAppUrl(createdItem), '_blank')}
              style={{ padding:'7px 10px', border:'none', borderRadius:9, background:'#25D366', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              title="Share on WhatsApp"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
            <button
              onClick={() => setCreatedItem(null)}
              style={{ padding:'7px 14px', border:'1px solid #86efac', borderRadius:9, background:'transparent', color:'#166534', fontFamily:'var(--fb)', fontSize:13, fontWeight:600, cursor:'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <CRow className="g-3">
        {/* ── Create form ── */}
        <CCol lg={5}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>Create item</h5>
                <span style={{ fontSize:11, color:'var(--ink3)' }}>raise a need / request to another unit</span>
              </div>

              <div className="mb-3">
                <CFormLabel style={LBL}>Type</CFormLabel>
                <CFormSelect value={fType} onChange={e => setFType(e.target.value)}>
                  {ITEM_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormLabel style={LBL}>Title</CFormLabel>
                <CFormInput value={fTitle}
                  onChange={e => { setFTitle(e.target.value); setFe(p => ({ ...p, fTitle: '' })); }}
                  placeholder="Short summary of the item"
                  style={fe.fTitle ? { borderColor: '#dc2626' } : {}} />
                {fe.fTitle && <div style={ERR}>⚠ {fe.fTitle}</div>}
              </div>

              <div className="mb-3">
                <CFormLabel style={LBL}>Raise to unit(s)</CFormLabel>
                <div className="d-flex flex-column gap-2">
                  {fe.fTargets && <div style={{ ...ERR, marginBottom: 6 }}>⚠ {fe.fTargets}</div>}
                  {targetableUnits.map(u => (
                    <label key={u.id} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, cursor:'pointer', padding:'8px 11px', border:'1px solid var(--line)', borderRadius:9, background:'#fff' }}>
                      <input type="checkbox" style={{ width:16, height:16, accentColor:'var(--ink)' }}
                        checked={fTargets.includes(u.id)}
                        onChange={e => { setFTargets(t => e.target.checked ? [...t,u.id] : t.filter(x => x!==u.id)); setFe(p => ({ ...p, fTargets: '' })); }} />
                      <span style={{ width:10, height:10, borderRadius:'50%', background:u.color, display:'inline-block' }} />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Assign to user */}
              {fTargets.length > 0 && (
                <div className="mb-3">
                  <CFormLabel style={LBL}>
                    Assign to <span style={{ textTransform:'none', letterSpacing:0, opacity:.65 }}>(optional — user in target unit)</span>
                  </CFormLabel>
                  {assignableUsers.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--ink3)', fontStyle:'italic', padding:'8px 0' }}>
                      No users found in the selected unit(s).
                    </div>
                  ) : (
                    <CFormSelect value={fAssignTo} onChange={e => setFAssignTo(e.target.value)}>
                      <option value="">— Unassigned —</option>
                      {assignableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                      ))}
                    </CFormSelect>
                  )}
                </div>
              )}

              <div className="mb-3">
                <CFormLabel style={LBL}>Details</CFormLabel>
                <CFormTextarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="What you need / what support is requested…" rows={3} />
              </div>

              <CRow className="g-2 mb-3">
                <CCol>
                  <CFormLabel style={LBL}>Priority</CFormLabel>
                  <CFormSelect value={fPrio} onChange={e => setFPrio(e.target.value)}>
                    {['Normal','High','Critical'].map(p => <option key={p}>{p}</option>)}
                  </CFormSelect>
                </CCol>
                <CCol>
                  <CFormLabel style={LBL}>Will get ID</CFormLabel>
                  <CFormInput disabled value={`${curType.code}-???`} style={{ background:'var(--paper)' }} />
                </CCol>
              </CRow>

              {/* SLA dates */}
              <div style={{ background:'var(--paper)', border:'1px solid var(--line)', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                <div style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:10 }}>
                  🎯 SLA (Service Level Agreement)
                </div>
                <CRow className="g-2">
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Start date</CFormLabel>
                    <DateField value={fSlaStart} onChange={setFSlaStart} placeholder="SLA start" />
                  </CCol>
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>End date</CFormLabel>
                    <DateField value={fSlaEnd} onChange={setFSlaEnd} placeholder="SLA end" />
                  </CCol>
                </CRow>
                {fSlaStart && fSlaEnd && (() => {
                  // Compute a preview SLA card inline
                  const preview = { sla_start:fSlaStart, sla_end:fSlaEnd, sla_metrics: (() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const s = new Date(fSlaStart+'T00:00:00');
                    const e = new Date(fSlaEnd+'T00:00:00');
                    const total = Math.round((e-s)/86400000);
                    if (total <= 0) return null;
                    const elapsed = Math.max(0, Math.round((today-s)/86400000));
                    const remaining = Math.max(0, Math.round((e-today)/86400000));
                    const pct = Math.min(100, Math.round(elapsed/total*100));
                    const status = today < s ? 'not_started' : today > e ? 'breached'
                      : remaining === 0 ? 'due_today' : pct >= 80 ? 'warning' : 'on_track';
                    return { total_days:total, elapsed_days:elapsed, remaining_days:remaining,
                             overdue_days:Math.max(0,-Math.round((e-today)/86400000)), progress_pct:pct, status };
                  })() };
                  return <div style={{ marginTop:8 }}><SLACard item={preview} /></div>;
                })()}
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <CButton color="dark" className="flex-grow-1" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create item'}
                </CButton>
                <CButton color="dark" variant="outline" onClick={() => fTitle && window.open(buildEmail({ type:fType, item_id:`${curType.code}-???`, title:fTitle, status:'pending', raiser:raisedByUnit??{name:'—'}, targets:targetableUnits.filter(u=>fTargets.includes(u.id)), description:fDesc }))}>
                  ✉ Email draft
                </CButton>
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Item list ── */}
        <CCol lg={7}>
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:18, margin:0 }}>
                  {user?.role==='admin' ? 'All items' : "My unit's items"}
                </h5>
                <span style={{ fontSize:11, color:'var(--ink3)' }}>tap to open · add action items</span>
              </div>
              {items.length === 0
                ? <div style={{ fontSize:13, color:'var(--ink3)', fontStyle:'italic' }}>No items {filter==='all'?'yet':`with status "${filter}"`}.</div>
                : items.map(item => {
                    const t      = typeByValue[item.type] ?? ITEM_TYPES[0];
                    const tg     = item.targets.map(u => u.abbr).join(', ');
                    const slaStatus = item.sla_metrics?.status ?? (item.sla_end ? slaInfo(item.sla_end)?.status : null);
                    const rowAccent = slaStatus === 'breached'  ? '#dc2626'
                                    : slaStatus === 'due_today' ? '#b45309'
                                    : slaStatus === 'warning'   ? '#d97706'
                                    : 'transparent';
                    return (
                      <div key={item.id}
                        className={`itemrow prio-${item.priority}`}
                        onClick={() => setModal(item)}
                        style={rowAccent !== 'transparent' ? { borderLeft:`3px solid ${rowAccent}`, paddingLeft:10 } : {}}
                      >
                        <span className="iid" style={{ background:t.color }}>{item.item_id}</span>
                        <div className="imain">
                          <div className="it">{item.title}</div>
                          <div className="imeta">
                            <span>{t.label}</span><span>·</span>
                            <i style={{ width:8, height:8, borderRadius:'50%', background:item.raiser.color, display:'inline-block' }} />
                            {item.raiser.abbr}<span>→</span>{tg}<span>·</span>
                            {item.action_items.length} action item(s)
                            {item.assigned_to_name && (
                              <><span>·</span><span style={{ color:'var(--ink2)', fontStyle:'italic' }}>👤 {item.assigned_to_name}</span></>
                            )}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                            {(item.sla_start || item.sla_end) && <SLAChip item={item} />}
                          </div>
                        </div>
                        <CBadge color={STAT_COLOR[item.status]??'secondary'} style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'.04em', padding:'4px 10px', borderRadius:99 }}>
                          {item.status}
                        </CBadge>
                      </div>
                    );
                  })
              }
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {modal && (
        <ItemModal
          item={items.find(i => i.id === modal.id) ?? modal}
          isAdmin={user?.role === 'admin'}
          onClose={() => setModal(null)}
          onStatusChange={(id, s) => statusMutation.mutate({ id, status:s })}
          onAddAI={(id, text) => aiMutation.mutate({ id, text })}
          onToggleAI={(itemId, aiId) => toggleAiMutation.mutate({ itemId, aiId })}
          onEmail={(item) => window.open(buildEmail(item))}
          onUpdateItem={(id, data) => updateMutation.mutate({ id, ...data })}
        />
      )}
    </>
  );
}

/* ── SLA History section ─────────────────────────────────── */
function SLAHistorySection({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--ink3)', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:8 }}>
        SLA Change History
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {history.map(h => (
          <div key={h.id} style={{ background:'var(--paper)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--ink2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontWeight:600, color:'var(--ink)' }}>{h.changed_by_name}</span>
              <span style={{ color:'var(--ink3)' }}>{h.changed_at?.slice(0,16).replace('T',' ')}</span>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:99, fontSize:11 }}>
                {h.old_start ?? '—'} → {h.old_end ?? '—'}
              </span>
              <span style={{ color:'var(--ink3)' }}>→</span>
              <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 8px', borderRadius:99, fontSize:11 }}>
                {h.new_start ?? '—'} → {h.new_end ?? '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Item Modal ──────────────────────────────────────────── */
function ItemModal({ item, isAdmin, onClose, onStatusChange, onAddAI, onToggleAI, onEmail, onUpdateItem }) {
  const toast  = useToast();
  const [aiText,  setAiText]  = useState('');
  const [editSLA, setEditSLA] = useState(false);
  const [slaStart,  setSlaStart]  = useState(item.sla_start ?? '');
  const [slaEnd,    setSlaEnd]    = useState(item.sla_end ?? '');

  // Fetch users in this item's target units for reassignment
  const targetUnitIds = item.targets?.map(u => u.id) ?? [];
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['users-by-units', targetUnitIds],
    queryFn:  () => getUsersByUnits(targetUnitIds),
    enabled:  targetUnitIds.length > 0,
  });

  const [editAssign, setEditAssign] = useState(false);
  const [assignDraft, setAssignDraft] = useState(item.assigned_to_name ? String(
    assignableUsers.find(u => u.name === item.assigned_to_name)?.id ?? ''
  ) : '');

  const t = typeByValue[item.type] ?? ITEM_TYPES[0];

  const STAT_COLOR = { open:'info', pending:'warning', closed:'success' };

  const saveSLA = () => {
    onUpdateItem(item.id, { sla_start: slaStart || null, sla_end: slaEnd || null });
    setEditSLA(false);
  };

  const saveAssign = () => {
    onUpdateItem(item.id, { assigned_to_id: assignDraft ? Number(assignDraft) : null });
    setEditAssign(false);
  };

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{
        padding:'20px 24px 16px', borderBottom:'1px solid var(--line)',
        position:'sticky', top:0, background:'var(--panel)', zIndex:2,
      }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <span className="iid" style={{ background:t.color, flexShrink:0, marginTop:2 }}>{item.item_id}</span>
          <span style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:18, lineHeight:1.35, flex:1, color:'var(--ink)' }}>{item.title}</span>
          <button onClick={onClose}
            style={{ flexShrink:0, border:'1px solid var(--line)', background:'var(--paper)', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:15, color:'var(--ink2)', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
          >✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, flexWrap:'wrap' }}>
          <CBadge color={STAT_COLOR[item.status]??'secondary'} style={{ fontSize:11, letterSpacing:'.03em', textTransform:'uppercase', padding:'3px 10px', borderRadius:99 }}>{item.status}</CBadge>
          <span style={{ fontSize:13, color:'var(--ink3)' }}>·</span>
          <span style={{ fontSize:13, color:'var(--ink2)' }}>{t.label}</span>
          <span style={{ fontSize:13, color:'var(--ink3)' }}>·</span>
          <span style={{ fontSize:13, color:item.priority==='Critical'?'var(--bad)':item.priority==='High'?'var(--warn)':'var(--ink2)' }}>{item.priority} priority</span>
          <span style={{ fontSize:13, color:'var(--ink3)' }}>·</span>
          <span style={{ fontSize:13, color:'var(--ink3)' }}>raised {item.created_at?.slice(0,10)}</span>
        </div>
      </div>

      <div style={{ padding:'0 24px 24px' }}>

        {/* Raised by → to */}
        <div style={{ borderBottom:'1px solid var(--line)', padding:'14px 0' }}>
          <div style={{ fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:8 }}>Raised by → to</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:13 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontWeight:600 }}>
              <i style={{ width:9, height:9, borderRadius:'50%', background:item.raiser.color, display:'inline-block', flexShrink:0 }} />{item.raiser.name}
            </span>
            <span style={{ color:'var(--ink3)', fontSize:13 }}>→</span>
            {item.targets.map(u => (
              <span key={u.id} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, color:'var(--ink2)' }}>
                <i style={{ width:9, height:9, borderRadius:'50%', background:u.color, display:'inline-block', flexShrink:0 }} />{u.name}
              </span>
            ))}
          </div>
        </div>

        {/* ── Assignment ── */}
        <div style={{ borderBottom:'1px solid var(--line)', padding:'14px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)' }}>Assigned To</div>
            {isAdmin && !editAssign && (
              <button
                onClick={() => setEditAssign(true)}
                style={{ border:'none', background:'var(--accent-light)', color:'var(--accent-dark)', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:7, cursor:'pointer' }}
              >
                {item.assigned_to_name ? 'Reassign' : '+ Assign'}
              </button>
            )}
          </div>
          {editAssign ? (
            <div>
              <select
                value={assignDraft}
                onChange={e => setAssignDraft(e.target.value)}
                style={{ width:'100%', border:'1.5px solid var(--line)', borderRadius:9, padding:'9px 12px', fontFamily:'var(--fb)', fontSize:14, background:'#fff', color:'var(--ink)', boxSizing:'border-box', outline:'none', marginBottom:8 }}
              >
                <option value="">— Unassigned —</option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                ))}
              </select>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={saveAssign} style={{ flex:1, border:'none', background:'var(--accent)', color:'#fff', fontWeight:600, fontSize:13, padding:'8px 0', borderRadius:9, cursor:'pointer' }}>Save</button>
                <button onClick={() => setEditAssign(false)} style={{ flex:1, border:'1px solid var(--line)', background:'transparent', color:'var(--ink2)', fontSize:13, padding:'8px 0', borderRadius:9, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : item.assigned_to_name ? (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:10, background:'#e0f2fe', border:'1px solid #7dd3fc' }}>
              <span style={{ fontSize:16 }}>👤</span>
              <span style={{ fontFamily:'var(--fb)', fontWeight:600, fontSize:14, color:'#0c4a6e' }}>{item.assigned_to_name}</span>
            </div>
          ) : (
            <div style={{ fontSize:13, color:'var(--ink3)', fontStyle:'italic' }}>Not assigned</div>
          )}
        </div>

        {/* ── SLA ── */}
        <div style={{ borderBottom:'1px solid var(--line)', padding:'14px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)' }}>SLA Dates</div>
            {isAdmin && !editSLA && (
              <button
                onClick={() => setEditSLA(true)}
                style={{ border:'none', background:'var(--accent-light)', color:'var(--accent-dark)', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:7, cursor:'pointer' }}
              >
                {item.sla_end ? 'Change SLA' : '+ Set SLA'}
              </button>
            )}
          </div>
          {editSLA ? (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ ...LBL, display:'block', marginBottom:6 }}>Start</label>
                  <DateField value={slaStart} onChange={setSlaStart} placeholder="SLA start" />
                </div>
                <div>
                  <label style={{ ...LBL, display:'block', marginBottom:6 }}>End</label>
                  <DateField value={slaEnd} onChange={setSlaEnd} placeholder="SLA end" />
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={saveSLA} style={{ flex:1, border:'none', background:'var(--accent)', color:'#fff', fontWeight:600, fontSize:13, padding:'8px 0', borderRadius:9, cursor:'pointer' }}>Save SLA</button>
                <button onClick={() => setEditSLA(false)} style={{ flex:1, border:'1px solid var(--line)', background:'transparent', color:'var(--ink2)', fontSize:13, padding:'8px 0', borderRadius:9, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <SLACard item={item} />
              <SLAHistorySection history={item.sla_history} />
            </div>
          )}
        </div>

        {/* Details */}
        {item.description && (
          <div style={{ borderBottom:'1px solid var(--line)', padding:'14px 0' }}>
            <div style={{ fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:8 }}>Details</div>
            <div style={{ fontSize:15, lineHeight:1.65, color:'var(--ink2)' }}>{item.description}</div>
          </div>
        )}

        {/* Action items */}
        <div style={{ borderBottom:'1px solid var(--line)', padding:'14px 0' }}>
          <div style={{ fontSize:11, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:8 }}>
            Action items <span style={{ textTransform:'none', letterSpacing:0, opacity:.7 }}>— each tracked with its own AI- id</span>
          </div>
          {item.action_items.length === 0
            ? <div style={{ fontSize:13, color:'var(--ink3)', fontStyle:'italic' }}>No action items yet.</div>
            : item.action_items.map(ai => (
                <div key={ai.id} style={{ display:'flex', gap:9, alignItems:'flex-start', padding:'8px 0', fontSize:15, borderBottom:'1px solid var(--line2)' }}>
                  <span onClick={() => onToggleAI(item.id, ai.id)}
                    style={{ width:16, height:16, borderRadius:5, border:`1.5px solid ${ai.done?'var(--ok)':'var(--ink3)'}`, background:ai.done?'var(--ok)':'transparent', flexShrink:0, marginTop:2, cursor:'pointer', position:'relative', display:'inline-block' }}>
                    {ai.done && <span style={{ position:'absolute', left:4.5, top:1.5, width:4, height:8, border:'solid #fff', borderWidth:'0 2px 2px 0', transform:'rotate(45deg)', display:'block' }} />}
                  </span>
                  <span style={{ fontSize:11, color:'var(--ink3)', background:'var(--paper)', padding:'3px 7px', borderRadius:6, whiteSpace:'nowrap', marginTop:2 }}>{ai.aid}</span>
                  <span style={{ color:ai.done?'var(--ink3)':'var(--ink)', textDecoration:ai.done?'line-through':'none' }}>{ai.text}</span>
                </div>
              ))
          }
          <div style={{ marginTop:12 }}>
            <textarea
              value={aiText} onChange={e => setAiText(e.target.value)}
              placeholder="Add an action item (gets an AI- tracking id)…"
              style={{ width:'100%', border:'1px solid var(--line)', borderRadius:10, padding:'11px 13px', fontFamily:'var(--fb)', fontSize:15, resize:'vertical', minHeight:64, background:'#fff', color:'var(--ink)', lineHeight:1.5 }}
            />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:9 }}>
              <span style={{ fontSize:11, color:'var(--ink3)' }}>Add action item</span>
              <button
                disabled={!aiText.trim()}
                onClick={() => { onAddAI(item.id, aiText.trim()); setAiText(''); }}
                style={{ border:0, background:'var(--accent)', color:'#fff', fontFamily:'var(--fb)', fontWeight:600, fontSize:13, padding:'10px 18px', borderRadius:10, cursor:'pointer', transition:'.15s', opacity:aiText.trim()?1:0.4 }}
              >Add action item</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
          {item.status !== 'closed' && (
            <CButton color="dark" className="flex-grow-1" onClick={() => onStatusChange(item.id, 'closed')}>Mark closed</CButton>
          )}
          {item.status === 'closed'
            ? <CButton color="dark" variant="outline" onClick={() => onStatusChange(item.id, 'pending')}>Reopen</CButton>
            : <CButton color="dark" variant="outline" onClick={() => onStatusChange(item.id, item.status==='pending'?'open':'pending')}>
                Mark {item.status==='pending'?'open':'pending'}
              </CButton>
          }
          <CButton color="dark" variant="outline" onClick={() => onEmail(item)}>✉ Email</CButton>
          <button
            onClick={() => window.open(buildWhatsAppUrl(item), '_blank')}
            style={{ padding:'6px 9px', border:'none', borderRadius:9, background:'#25D366', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
            title="Share on WhatsApp"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </div>
    </Modal>
  );
}
