import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLetters, uploadLetter, deleteLetter } from '../api/documents';
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

const LBL = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4 };
const ROW = { padding: '14px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 15 };
const today    = new Date().toISOString().slice(0, 10);
const thisYear = new Date().getFullYear();

function letterYear(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).getFullYear();
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isPOC    = user?.role === 'poc';
  const isAdmin  = user?.role === 'admin';
  const fileRef  = useRef(null);

  const [yearFilter, setYearFilter] = useState(String(thisYear));

  const { data: letters = [], isLoading } = useQuery({ queryKey: ['letters'], queryFn: getLetters });

  const years = useMemo(() => {
    const set = new Set();
    letters.forEach(l => { if (l.date) set.add(String(letterYear(l.date))); });
    if (!set.size) set.add(String(thisYear));
    return [...set].sort().reverse();
  }, [letters]);

  const filtered = useMemo(() =>
    letters.filter(l => !yearFilter || String(letterYear(l.date)) === yearFilter),
    [letters, yearFilter]
  );

  const thisYearCount = useMemo(() => letters.filter(l => String(letterYear(l.date)) === String(thisYear)).length, [letters]);
  const myUploads     = useMemo(() => letters.filter(l => l.uploaded_by === user?.id).length, [letters, user]);
  const circulatedCount = useMemo(() => letters.filter(l => l.visible_to_all).length, [letters]);

  const statCards = isPOC ? [
    { hero: true, l: 'Total Letters', v: letters.length,   sub: 'visible to you'  },
    { l: 'This Year',                 v: thisYearCount,    sub: String(thisYear)   },
    { l: 'My Uploads',                v: myUploads,        sub: 'uploaded by you'  },
    { l: 'Showing',                   v: filtered.length,  sub: `in ${yearFilter}` },
  ] : [
    { hero: true, l: 'Total Letters', v: letters.length,   sub: 'all time'         },
    { l: 'This Year',                 v: thisYearCount,    sub: String(thisYear)    },
    { l: 'Circulated',                v: circulatedCount,  sub: 'shared with teams' },
    { l: 'Showing',                   v: filtered.length,  sub: `in ${yearFilter}`  },
  ];

  /* Upload form state — POC only */
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

  /* A POC can delete only their own uploads; admin can delete any */
  const canDelete = (l) => isAdmin || l.uploaded_by === user?.id;

  return (
    <>
      <div className="filterbar">
        <div className="period">
          <div className="l">D.O. Letters</div>
          <div className="v">
            {isPOC ? `${user.unit_name ?? 'Your unit'} — correspondence` : 'Official correspondence archive'}
          </div>
        </div>
        <div className="seg">
          {years.map(y => (
            <button key={y} className={yearFilter === y ? 'on' : ''} onClick={() => setYearFilter(y)}>{y}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
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

      <CRow className="g-3">
        {/* ── Left: Upload form — POC only ── */}
        {isPOC && (
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

                {/* Circulate toggle */}
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
                      Admin and all unit POCs will see this letter
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
        <CCol lg={isPOC ? 7 : 12}>
          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                  Letters — {yearFilter} {isLoading ? <CSpinner size="sm" /> : `(${filtered.length})`}
                </span>
                {isAdmin && (
                  <span style={{ fontSize: 11, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--line)', padding: '3px 10px', borderRadius: 99 }}>
                    View only
                  </span>
                )}
              </div>

              {!isLoading && filtered.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--ink3)' }}>No letters for {yearFilter}.</div>
              )}

              {filtered.map(l => (
                <div key={l.id} style={ROW}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{l.title}</div>

                      {/* Badges row */}
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
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
