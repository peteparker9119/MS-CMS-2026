import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLetters, uploadLetter, deleteLetter, updateLetter, getCompliance } from '../api/documents';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';

const ERR = { fontSize: 11, color: '#dc2626', marginTop: 4 };
import DateField from '../components/DateField';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormTextarea,
  CRow, CCol, CSpinner,
} from '@coreui/react';

const LBL   = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4 };
const ROW   = { padding: '14px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 15 };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_COLORS = [
  '#6366f1', // Jan — indigo
  '#ec4899', // Feb — pink
  '#f97316', // Mar — orange
  '#14b8a6', // Apr — teal
  '#22c55e', // May — green
  '#3b82f6', // Jun — blue
  '#f59e0b', // Jul — amber
  '#ef4444', // Aug — red
  '#8b5cf6', // Sep — violet
  '#06b6d4', // Oct — cyan
  '#84cc16', // Nov — lime
  '#10b981', // Dec — emerald
];
const today    = new Date().toISOString().slice(0, 10);
const thisYear = new Date().getFullYear();

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isPOC    = user?.role === 'poc';
  const isAdmin  = user?.role === 'admin';
  const fileRef  = useRef(null);

  /* ── Filter state ── */
  const [yearFilter,  setYearFilter]  = useState(String(thisYear));
  const [monthFilter, setMonthFilter] = useState([]);     // array of selected months (1-12)

  const usingRange = false;

  const { data: letters = [], isLoading } = useQuery({ queryKey: ['letters'], queryFn: getLetters });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: getUnits });
  const { data: compliance = [] } = useQuery({
    queryKey: ['compliance', yearFilter],
    queryFn: () => getCompliance(yearFilter),
    enabled: isAdmin,
  });
  const [circulateId, setCirculateId] = useState(null);

  /* Available years from data */
  const years = useMemo(() => {
    const set = new Set();
    letters.forEach(l => { if (l.date) set.add(String(new Date(l.date).getFullYear())); });
    if (!set.size) set.add(String(thisYear));
    return [...set].sort().reverse();
  }, [letters]);

  /* Per-month counts for the selected year (used by month cards) */
  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    letters.forEach(l => {
      if (!l.date) return;
      const d = new Date(l.date);
      if (String(d.getFullYear()) === yearFilter) counts[d.getMonth()]++;
    });
    return counts;
  }, [letters, yearFilter]);

  /* Final filtered list */
  const filtered = useMemo(() => letters.filter(l => {
    if (!l.date) return false;
    const d = new Date(l.date);
    if (yearFilter               && String(d.getFullYear()) !== yearFilter)    return false;
    if (monthFilter.length > 0   && !monthFilter.includes(d.getMonth() + 1))  return false;
    return true;
  }), [letters, yearFilter, monthFilter]);

  /* Stat cards */
  const thisYearCount   = useMemo(() => letters.filter(l => l.date && String(new Date(l.date).getFullYear()) === String(thisYear)).length, [letters]);
  const myUploads       = useMemo(() => letters.filter(l => l.uploaded_by === user?.id).length, [letters, user]);
  const circulatedCount = useMemo(() => letters.filter(l => l.visible_to_all).length, [letters]);

  const filterLabel = monthFilter.length > 0
    ? monthFilter.map(m => MONTHS[m - 1]).join(', ') + ` ${yearFilter}`
    : yearFilter;

  const statCards = isPOC ? [
    { hero: true, l: 'Total Letters', v: letters.length,  sub: 'visible to you'   },
    { l: 'This Year',                 v: thisYearCount,   sub: String(thisYear)    },
    { l: 'My Uploads',                v: myUploads,       sub: 'uploaded by you'   },
    { l: 'Showing',                   v: filtered.length, sub: filterLabel         },
  ] : [
    { hero: true, l: 'Total Letters', v: letters.length,  sub: 'all time'          },
    { l: 'This Year',                 v: thisYearCount,   sub: String(thisYear)    },
    { l: 'Circulated',                v: circulatedCount, sub: 'shared with teams' },
    { l: 'Showing',                   v: filtered.length, sub: filterLabel         },
  ];

  /* Upload form state */
  const [title,  setTitle]  = useState('');
  const [refNo,  setRefNo]  = useState('');
  const [date,   setDate]   = useState(today);
  const [desc,   setDesc]   = useState('');
  const [file,   setFile]   = useState(null);
  const [visAll, setVisAll] = useState(false);
  const [fe,     setFe]     = useState({});

  const uploadMut = useMutation({
    mutationFn: uploadLetter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['letters'] });
      setTitle(''); setRefNo(''); setDate(today); setDesc(''); setFile(null); setVisAll(false); setFe({});
      if (fileRef.current) fileRef.current.value = '';
      toast('Letter uploaded');
    },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const handleUpload = () => {
    const errors = {};
    if (!title.trim()) errors.title = 'Letter title is required';
    if (!file)         errors.file  = 'Select a PDF or DOC file to upload';
    if (Object.keys(errors).length) { setFe(errors); return; }
    setFe({});
    const fd = new FormData();
    fd.append('title', title);
    fd.append('reference_number', refNo);
    fd.append('date', date);
    fd.append('file', file);
    fd.append('description', desc);
    fd.append('visible_to_all', visAll ? 'true' : 'false');
    uploadMut.mutate(fd);
  };

  const deleteMut = useMutation({
    mutationFn: deleteLetter,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['letters'] }); toast('Deleted'); },
    onError: (err) => toast(getErrorMessage(err)),
  });

  const updateLetterMut = useMutation({
    mutationFn: ({ id, data }) => updateLetter(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['letters'] }); toast('Letter updated'); setCirculateId(null); },
    onError: () => toast('Failed to update'),
  });

  const canDelete = (l) => isAdmin || l.uploaded_by === user?.id;

  /* Handlers */
  const selectMonth = (m) => setMonthFilter(prev =>
    prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
  );
  const selectYear = (y) => { setYearFilter(y); setMonthFilter([]); };
  const clearAll   = ()  => { setMonthFilter([]); setYearFilter(String(thisYear)); };

  const anyFilter = monthFilter.length > 0;

  return (
    <>
      {/* ── Header bar ── */}
      <div className="filterbar">
        <div className="period">
          <div className="l">D.O. Letters</div>
          <div className="v">
            {isPOC ? `${user.unit_name ?? 'Your unit'} — correspondence` : 'Official correspondence archive'}
          </div>
        </div>
        <div className="seg">
          {years.map(y => (
            <button key={y} className={yearFilter === y && !usingRange ? 'on' : ''} onClick={() => selectYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <CRow className="g-3 mb-3">
        {statCards.map((c, i) => (
          <CCol key={i} xs={6} md={3}>
            <CCard style={c.hero ? { background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', border: 'none', color: '#fff' } : {}}>
              <CCardBody style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: c.hero ? 'rgba(255,255,255,.55)' : 'var(--ink3)' }}>{c.l}</div>
                <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 28, lineHeight: 1, marginTop: 9 }}>{c.v}</div>
                <div style={{ fontSize: 11, marginTop: 6, color: c.hero ? 'rgba(255,255,255,.8)' : 'var(--ink3)' }}>{c.sub}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      {/* ── Month filter cards ── */}
      <CCard className="mb-3" style={{ border: '1px solid var(--line)' }}>
        <CCardBody style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink3)' }}>
              Month — {yearFilter}
            </span>
            {anyFilter && (
              <button onClick={clearAll} style={{ border: 'none', background: 'none', fontSize: 10, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: '1px 6px' }}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Month cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 5, marginBottom: 10 }}>
            {MONTHS.map((m, i) => {
              const mo     = i + 1;
              const cnt    = monthCounts[i];
              const active = monthFilter.includes(mo);
              const color  = MONTH_COLORS[i];
              return (
                <div
                  key={m}
                  onClick={() => selectMonth(mo)}
                  style={{
                    padding: '5px 2px',
                    borderRadius: 7,
                    border: `1.5px solid ${active ? color : 'var(--line)'}`,
                    background: active ? color : '#fff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all .13s',
                    opacity: cnt === 0 && !active ? 0.45 : 1,
                  }}
                >
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 9, fontWeight: 700, color: active ? '#fff' : 'var(--ink)', letterSpacing: '.03em' }}>{m}</div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: active ? '#fff' : 'var(--ink)', lineHeight: 1.3 }}>{cnt}</div>
                </div>
              );
            })}
          </div>

        </CCardBody>
      </CCard>

      {isAdmin && (
        <CCard className="mb-3">
          <CCardBody style={{ padding:'14px 16px' }}>
            <div style={{ fontFamily:'var(--fd)', fontWeight:600, fontSize:15, marginBottom:12 }}>
              DO Letter Compliance — {yearFilter}
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left', padding:'5px 8px', fontFamily:'var(--fm)', color:'var(--ink3)', fontWeight:600, borderBottom:'1px solid var(--line)', minWidth:100 }}>Unit</th>
                    {MONTHS.map(m => (
                      <th key={m} style={{ padding:'5px 6px', fontFamily:'var(--fm)', color:'var(--ink3)', fontWeight:600, borderBottom:'1px solid var(--line)', textAlign:'center', minWidth:38 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compliance.map(row => (
                    <tr key={row.unit_id}>
                      <td style={{ padding:'6px 8px', fontWeight:600, color:row.unit_color, fontSize:12 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', background:row.unit_color, display:'inline-block' }} />
                          {row.unit_abbr}
                        </span>
                      </td>
                      {MONTHS.map((_, mi) => {
                        const val = row.months[String(mi + 1)];
                        return (
                          <td key={mi} style={{ padding:'5px 6px', textAlign:'center' }}>
                            {val === true  && <span style={{ color:'#059669', fontSize:14, fontWeight:700 }}>✓</span>}
                            {val === false && <span style={{ color:'#dc2626', fontSize:13, fontWeight:700 }}>✗</span>}
                            {val === null  && <span style={{ color:'var(--line2)', fontSize:12 }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontFamily:'var(--fm)', fontSize:11, color:'var(--ink3)', marginTop:8 }}>
              Compliance is checked on the 13th of each month. ✓ uploaded · ✗ missed · — not yet checked
            </div>
          </CCardBody>
        </CCard>
      )}

      <CRow className="g-3">
        {/* ── Left: Upload form ── */}
        {(isPOC || isAdmin) && (
          <CCol lg={5}>
            <CCard>
              <CCardBody style={{ padding: '20px 22px' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Upload Letter</div>

                <div className="mb-3">
                  <CFormLabel style={LBL}>Title</CFormLabel>
                  <CFormInput value={title}
                    onChange={e => { setTitle(e.target.value); setFe(p => ({ ...p, title: '' })); }}
                    placeholder="Letter title"
                    style={fe.title ? { borderColor: '#dc2626' } : {}} />
                  {fe.title && <div style={ERR}>⚠ {fe.title}</div>}
                </div>

                <CRow className="g-2 mb-3">
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Reference Number</CFormLabel>
                    <CFormInput value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g. TN/EMIS/2025/001" />
                  </CCol>
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Date</CFormLabel>
                    <DateField value={date} onChange={v => setDate(v)} />
                  </CCol>
                </CRow>

                <div className="mb-3">
                  <CFormLabel style={LBL}>File (PDF / DOC)</CFormLabel>
                  <CFormInput
                    type="file"
                    accept=".pdf,.doc,.docx"
                    ref={fileRef}
                    onChange={e => { setFile(e.target.files[0] ?? null); setFe(p => ({ ...p, file: '' })); }}
                    style={fe.file ? { borderColor: '#dc2626' } : {}}
                  />
                  {fe.file && <div style={ERR}>⚠ {fe.file}</div>}
                </div>

                <div className="mb-3">
                  <CFormLabel style={LBL}>Description</CFormLabel>
                  <CFormTextarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief summary of letter contents…" />
                </div>

                <div
                  className="mb-3"
                  onClick={() => setVisAll(v => !v)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', border: `1px solid ${visAll ? 'rgba(16,185,129,.35)' : 'var(--line)'}`, borderRadius: 9, background: visAll ? 'rgba(16,185,129,.05)' : 'var(--paper)', cursor: 'pointer' }}
                >
                  <input type="checkbox" id="visAll" checked={visAll}
                    onChange={e => setVisAll(e.target.checked)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 16, height: 16, accentColor: 'var(--ok)', cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <label htmlFor="visAll" style={{ fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: visAll ? '#059669' : 'var(--ink2)', display: 'block' }}>
                      Circulate to all teams
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                      All unit reps will see this letter
                    </div>
                  </div>
                </div>

                <CButton color="dark" onClick={handleUpload} disabled={uploadMut.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                  {uploadMut.isPending ? <CSpinner size="sm" /> : 'Upload Letter'}
                </CButton>
              </CCardBody>
            </CCard>
          </CCol>
        )}

        {/* ── Right: Letter list ── */}
        <CCol lg={isPOC || isAdmin ? 7 : 12}>
          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                  Letters — {filterLabel} {isLoading ? <CSpinner size="sm" /> : `(${filtered.length})`}
                </span>
              </div>

              {!isLoading && filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>
                  No letters for {filterLabel}.
                </div>
              )}

              {filtered.map(l => (
                <div key={l.id} style={ROW}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{l.title}</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        {l.tracking_number && (
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                            {l.tracking_number}
                          </span>
                        )}
                        {l.visible_to_all ? (
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', background: 'rgba(16,185,129,.1)', color: '#059669', border: '1px solid rgba(16,185,129,.3)', padding: '2px 8px', borderRadius: 4 }}>
                            ✦ Circulated
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', background: 'var(--paper)', color: 'var(--ink3)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: 4 }}>
                            Unit only
                          </span>
                        )}
                      </div>

                      {l.reference_number && (
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 4 }}>Ref: {l.reference_number}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      {l.file_url && (
                        <a href={l.file_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 13, color: 'var(--info)', fontFamily: 'var(--fb)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--info)', borderRadius: 5 }}>
                          Download
                        </a>
                      )}
                      {canDelete(l) && (
                        <button
                          onClick={() => { if (window.confirm('Delete this letter?')) deleteMut.mutate(l.id); }}
                          style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: 'var(--bad)', fontSize: 13, fontFamily: 'var(--fb)' }}>
                          Delete
                        </button>
                      )}
                      {isAdmin && !l.visible_to_all && (
                        <button
                          onClick={() => setCirculateId(l.id)}
                          style={{ background: 'none', border: '1px solid #059669', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: '#059669', fontSize: 13, fontFamily: 'var(--fb)' }}>
                          Circulate
                        </button>
                      )}
                    </div>
                  </div>

                  {l.description && (
                    <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 4 }}>{l.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>{l.date}</span>
                    {l.uploaded_by_name && <span>By: {l.uploaded_by_name}</span>}
                    {l.uploaded_at && <span>{new Date(l.uploaded_at).toLocaleDateString()}</span>}
                  </div>
                  {isAdmin && circulateId === l.id && (
                    <div style={{ padding: '12px 18px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0', margin: '10px -18px -14px', borderRadius: '0 0 0 0' }}>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Select teams to circulate to:</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {units.map(u => (
                          <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 7, background: '#fff' }}>
                            <input type="checkbox" defaultChecked style={{ accentColor: u.color }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.color, display: 'inline-block' }} />
                            {u.abbr}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => updateLetterMut.mutate({ id: l.id, data: { visible_to_all: true } })}
                          style={{ border: 'none', background: '#059669', color: '#fff', borderRadius: 7, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
                          ✦ Circulate to all teams
                        </button>
                        <button onClick={() => setCirculateId(null)}
                          style={{ border: '1px solid var(--line)', background: '#fff', color: 'var(--ink2)', borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
