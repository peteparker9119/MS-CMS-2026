import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTemplates, createTemplate, getReviewEntries, createReviewEntry, getReviewSummary } from '../api/reviews';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea,
  CRow, CCol, CBadge, CSpinner,
} from '@coreui/react';

const FREQ_OPTS = ['All', 'Weekly', 'Monthly', 'Quarterly'];
const FREQ_API  = { 'All': '', 'Weekly': 'weekly', 'Monthly': 'monthly', 'Quarterly': 'quarterly' };
const LBL = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4 };
const ROW = { padding: '10px 14px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 13 };
const today = new Date().toISOString().slice(0, 10);

export default function ReviewsPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isAdmin  = user?.role === 'admin';

  const [freqFilter, setFreqFilter] = useState('All');

  const { data: templates = [], isLoading: tmplLoading } = useQuery({ queryKey: ['review-templates'], queryFn: getTemplates });
  const { data: entries   = [], isLoading: entryLoading } = useQuery({ queryKey: ['review-entries'],  queryFn: getReviewEntries });
  const { data: units     = [] }                          = useQuery({ queryKey: ['units'],            queryFn: getUnits });
  useQuery({ queryKey: ['review-summary'],  queryFn: getReviewSummary });

  const filteredTemplates = useMemo(() =>
    FREQ_API[freqFilter]
      ? templates.filter(t => t.frequency === FREQ_API[freqFilter])
      : templates,
    [templates, freqFilter]
  );

  /* ── Create Template ── */
  const [tTitle, setTTitle] = useState('');
  const [tUnit,  setTUnit]  = useState('');
  const [tFreq,  setTFreq]  = useState('monthly');
  const [tDesc,  setTDesc]  = useState('');
  const [criteria, setCriteria] = useState([{ label: '', max_score: '' }]);

  const addCrit  = () => setCriteria(c => [...c, { label: '', max_score: '' }]);
  const remCrit  = (i) => setCriteria(c => c.filter((_, idx) => idx !== i));
  const setCrit  = (i, field, val) => setCriteria(c => c.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const tmplMut = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-templates'] });
      setTTitle(''); setTUnit(''); setTFreq('monthly'); setTDesc('');
      setCriteria([{ label: '', max_score: '' }]);
      toast('Template created');
    },
    onError: () => toast('Failed to create template'),
  });

  const handleCreateTemplate = () => {
    if (!tTitle.trim()) { toast('Enter template title'); return; }
    const validCrit = criteria.filter(c => c.label.trim() && c.max_score);
    tmplMut.mutate({ title: tTitle, unit: tUnit || undefined, frequency: tFreq, description: tDesc, criteria: validCrit });
  };

  /* ── Fill Review ── */
  const [selTmpl,   setSelTmpl]   = useState('');
  const [rDate,     setRDate]     = useState(today);
  const [rUnit,     setRUnit]     = useState(user?.unit_slug || '');
  const [rNotes,    setRNotes]    = useState('');
  const [scores,    setScores]    = useState({});  // criteriaIndex -> score

  const selTemplate = templates.find(t => String(t.id) === selTmpl);

  const entryMut = useMutation({
    mutationFn: createReviewEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-entries'] });
      setSelTmpl(''); setRDate(today); setRUnit(''); setRNotes(''); setScores({});
      toast('Review submitted');
    },
    onError: () => toast('Failed to submit review'),
  });

  const handleSubmitReview = () => {
    if (!selTmpl) { toast('Select a template'); return; }
    const scoreList = (selTemplate?.criteria ?? []).map((c, i) => ({
      criterion: c.label ?? c.id,
      score: +(scores[i] ?? 0),
    }));
    entryMut.mutate({ template: +selTmpl, date: rDate, unit: rUnit || undefined, overall_notes: rNotes, scores: scoreList });
  };

  /* ── Recent entries enriched ── */
  const recent = useMemo(() =>
    [...entries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20)
      .map(e => {
        const tmpl = templates.find(t => t.id === e.template);
        const scoreArr = e.scores ?? [];
        const avg = scoreArr.length
          ? (scoreArr.reduce((s, x) => s + (x.score ?? 0), 0) / scoreArr.length).toFixed(1)
          : null;
        return { ...e, tmpl_title: tmpl?.title ?? '—', avg_score: avg };
      }),
    [entries, templates]
  );

  return (
    <>
      <div className="filterbar">
        <div className="period">
          <div className="l">Review Formats</div>
          <div className="v">Templates &amp; review entries</div>
        </div>
        <div className="seg">
          {FREQ_OPTS.map(f => (
            <button key={f} className={freqFilter === f ? 'on' : ''} onClick={() => setFreqFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      <CRow className="g-3">
        {/* ── Left: Template builder + list ── */}
        <CCol lg={6}>
          {isAdmin && (
            <CCard className="mb-3">
              <CCardBody style={{ padding: '20px 22px' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Create Template</div>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Title</CFormLabel>
                  <CFormInput value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="e.g. Monthly Field Review" />
                </div>
                <CRow className="g-2 mb-3">
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Unit</CFormLabel>
                    <CFormSelect value={tUnit} onChange={e => setTUnit(e.target.value)}>
                      <option value="">— All units —</option>
                      {units.map(u => <option key={u.id ?? u.slug} value={u.id ?? u.slug}>{u.name}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Frequency</CFormLabel>
                    <CFormSelect value={tFreq} onChange={e => setTFreq(e.target.value)}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </CFormSelect>
                  </CCol>
                </CRow>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Description</CFormLabel>
                  <CFormTextarea rows={2} value={tDesc} onChange={e => setTDesc(e.target.value)} />
                </div>

                {/* Criteria builder */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...LBL, marginBottom: 8 }}>Criteria</div>
                  {criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <CFormInput
                        placeholder="Criterion label"
                        value={c.label}
                        onChange={e => setCrit(i, 'label', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <CFormInput
                        type="number"
                        placeholder="Max"
                        value={c.max_score}
                        onChange={e => setCrit(i, 'max_score', e.target.value)}
                        style={{ width: 72 }}
                      />
                      {criteria.length > 1 && (
                        <button onClick={() => remCrit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 18, padding: '0 4px' }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addCrit} style={{ background: 'none', border: '1px dashed var(--line)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', width: '100%' }}>
                    + Add criterion
                  </button>
                </div>

                <CButton color="dark" onClick={handleCreateTemplate} disabled={tmplMut.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                  {tmplMut.isPending ? <CSpinner size="sm" /> : 'Create Template'}
                </CButton>
              </CCardBody>
            </CCard>
          )}

          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                Templates {tmplLoading ? <CSpinner size="sm" /> : `(${filteredTemplates.length})`}
              </div>
              {!tmplLoading && filteredTemplates.length === 0 && (
                <div style={{ padding: 24, color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center' }}>No templates found.</div>
              )}
              {filteredTemplates.map(t => (
                <div key={t.id} style={ROW}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, flex: 1 }}>{t.title}</span>
                    <CBadge color="info" style={{ fontSize: 10 }}>{t.frequency}</CBadge>
                    {t.active !== false && <CBadge color="success" style={{ fontSize: 10 }}>Active</CBadge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {t.unit_name && <span>Unit: {t.unit_name}</span>}
                    <span>{t.criteria?.length ?? 0} criteria</span>
                    <span>{t.entries_count ?? 0} entries</span>
                  </div>
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Right: Fill review + recent ── */}
        <CCol lg={6}>
          <CCard className="mb-3">
            <CCardBody style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Fill Review</div>
              <div className="mb-3">
                <CFormLabel style={LBL}>Template</CFormLabel>
                <CFormSelect value={selTmpl} onChange={e => { setSelTmpl(e.target.value); setScores({}); }}>
                  <option value="">— Select template —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </CFormSelect>
              </div>
              <CRow className="g-2 mb-3">
                <CCol xs={6}>
                  <CFormLabel style={LBL}>Date</CFormLabel>
                  <CFormInput type="date" value={rDate} onChange={e => setRDate(e.target.value)} />
                </CCol>
                <CCol xs={6}>
                  <CFormLabel style={LBL}>Unit</CFormLabel>
                  <CFormSelect value={rUnit} onChange={e => setRUnit(e.target.value)}>
                    <option value="">— Select —</option>
                    {units.map(u => <option key={u.id ?? u.slug} value={u.id ?? u.slug}>{u.name}</option>)}
                  </CFormSelect>
                </CCol>
              </CRow>

              {/* Dynamic score inputs */}
              {selTemplate?.criteria?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...LBL, marginBottom: 8 }}>Scores</div>
                  {selTemplate.criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, fontSize: 13, fontFamily: 'var(--fm)' }}>
                        {c.label ?? c}
                        {c.max_score && <span style={{ color: 'var(--ink3)', fontSize: 11 }}> / {c.max_score}</span>}
                      </div>
                      <CFormInput
                        type="number"
                        min="0"
                        max={c.max_score || undefined}
                        value={scores[i] ?? ''}
                        onChange={e => setScores(s => ({ ...s, [i]: e.target.value }))}
                        style={{ width: 80 }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-3">
                <CFormLabel style={LBL}>Overall Notes</CFormLabel>
                <CFormTextarea rows={2} value={rNotes} onChange={e => setRNotes(e.target.value)} placeholder="Summary observations…" />
              </div>
              <CButton color="dark" onClick={handleSubmitReview} disabled={entryMut.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                {entryMut.isPending ? <CSpinner size="sm" /> : 'Submit Review'}
              </CButton>
            </CCardBody>
          </CCard>

          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                Recent Reviews {entryLoading && <CSpinner size="sm" />}
              </div>
              {!entryLoading && recent.length === 0 && (
                <div style={{ padding: 24, color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center' }}>No reviews yet.</div>
              )}
              {recent.map((e, i) => (
                <div key={e.id ?? i} style={ROW}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{e.tmpl_title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{e.date}</span>
                    {e.unit_name && <span>Unit: {e.unit_name}</span>}
                    {e.avg_score && <span style={{ color: 'var(--ok)', fontWeight: 600 }}>Avg: {e.avg_score}</span>}
                  </div>
                  {e.overall_notes && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4, fontStyle: 'italic' }}>{e.overall_notes}</div>}
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
