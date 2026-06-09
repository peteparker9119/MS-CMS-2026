import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getKPIs, createKPI, getKPIEntries, createKPIEntry, getKPISummary } from '../api/kpi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DateField from '../components/DateField';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea,
  CRow, CCol, CSpinner,
} from '@coreui/react';

const LBL  = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4 };
const ROW  = { padding: '10px 14px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 13 };
const today = new Date().toISOString().slice(0, 10);

export default function KPIPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isAdmin  = user?.role === 'admin';

  /* ── Data ── */
  const { data: kpis    = [], isLoading: kpiLoading }    = useQuery({ queryKey: ['kpis'],        queryFn: getKPIs });
  const { data: entries = [], isLoading: entryLoading }  = useQuery({ queryKey: ['kpi-entries'], queryFn: getKPIEntries });
  const { data: summary = {} }                           = useQuery({ queryKey: ['kpi-summary'], queryFn: getKPISummary });

  /* ── Stats ── */
  const metToday = useMemo(() => {
    return entries.filter(e => {
      if (e.date !== today) return false;
      const kpi = kpis.find(k => k.id === e.kpi);
      return kpi && +e.value >= +kpi.target_value;
    }).length;
  }, [entries, kpis]);

  const thisWeek = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const cutoff = d.toISOString().slice(0, 10);
    const week = entries.filter(e => e.date >= cutoff);
    if (!week.length) return '—';
    const met = week.filter(e => {
      const kpi = kpis.find(k => k.id === e.kpi);
      return kpi && +e.value >= +kpi.target_value;
    }).length;
    return `${Math.round((met / week.length) * 100)}%`;
  }, [entries, kpis]);

  /* ── Create KPI form ── */
  const [kTitle,   setKTitle]   = useState('');
  const [kUnit,    setKUnit]    = useState('');
  const [kTarget,  setKTarget]  = useState('');
  const [kFreq,    setKFreq]    = useState('daily');
  const [kDesc,    setKDesc]    = useState('');

  const kpiMut = useMutation({
    mutationFn: createKPI,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpis'] });
      setKTitle(''); setKUnit(''); setKTarget(''); setKFreq('daily'); setKDesc('');
      toast('KPI created');
    },
    onError: () => toast('Failed to create KPI'),
  });

  const handleCreateKPI = () => {
    if (!kTitle.trim()) { toast('Enter KPI title'); return; }
    if (!kTarget || isNaN(+kTarget)) { toast('Enter a valid target value'); return; }
    kpiMut.mutate({ title: kTitle, metric_unit: kUnit, target_value: +kTarget, frequency: kFreq, description: kDesc });
  };

  /* ── Log entry ── */
  const [selKPI,   setSelKPI]   = useState('');
  const [eValue,   setEValue]   = useState('');
  const [eNotes,   setENotes]   = useState('');
  const [eDate,    setEDate]    = useState(today);

  const entryMut = useMutation({
    mutationFn: createKPIEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpi-entries'] });
      qc.invalidateQueries({ queryKey: ['kpi-summary'] });
      setEValue(''); setENotes(''); setEDate(today);
      toast('Value logged');
    },
    onError: () => toast('Failed to log value'),
  });

  const handleLog = () => {
    if (!selKPI)  { toast('Select a KPI'); return; }
    if (!eValue || isNaN(+eValue)) { toast('Enter a valid value'); return; }
    entryMut.mutate({ kpi: +selKPI, value: +eValue, date: eDate, notes: eNotes });
  };

  /* ── Recent entries enriched ── */
  const recent = useMemo(() =>
    [...entries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20)
      .map(e => {
        const kpi = kpis.find(k => k.id === e.kpi);
        return { ...e, kpi_title: kpi?.title ?? '—', target: kpi?.target_value, metric_unit: kpi?.metric_unit };
      }),
    [entries, kpis]
  );

  return (
    <>
      <div className="filterbar">
        <div className="period">
          <div className="l">KPI Tracking</div>
          <div className="v">Key Performance Indicators</div>
        </div>
      </div>

      {/* Stats */}
      <CRow className="g-3 mb-3">
        {[
          { hero: true, l: 'Total KPIs',       v: kpis.length,                sub: 'defined' },
          { l: 'Met Today',                     v: metToday,                   sub: 'targets hit today' },
          { l: 'This Week Hit Rate',            v: thisWeek,                   sub: 'last 7 days' },
          { l: 'Overall Compliance',            v: summary.compliance ?? '—',  sub: summary.period ?? '' },
        ].map((c, i) => (
          <CCol key={i} xs={6} md={3}>
            <CCard style={c.hero ? { background: 'var(--ink)', border: 'none', color: '#fff' } : {}}>
              <CCardBody style={{ padding: '16px 18px' }}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: c.hero ? 'rgba(255,255,255,.55)' : 'var(--ink3)' }}>{c.l}</div>
                <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 30, lineHeight: 1, marginTop: 9 }}>{c.v}</div>
                <div style={{ fontSize: 11, marginTop: 6, fontFamily: 'var(--fm)', color: c.hero ? 'rgba(255,255,255,.8)' : 'var(--ink3)' }}>{c.sub}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      <CRow className="g-3">
        {/* ── Left ── */}
        <CCol lg={6}>
          {isAdmin && (
            <CCard className="mb-3">
              <CCardBody style={{ padding: '20px 22px' }}>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Define KPI</div>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Title</CFormLabel>
                  <CFormInput value={kTitle} onChange={e => setKTitle(e.target.value)} placeholder="e.g. Daily calls made" />
                </div>
                <CRow className="g-2 mb-3">
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Metric Unit</CFormLabel>
                    <CFormInput value={kUnit} onChange={e => setKUnit(e.target.value)} placeholder="calls, %, visits…" />
                  </CCol>
                  <CCol xs={6}>
                    <CFormLabel style={LBL}>Target Value</CFormLabel>
                    <CFormInput type="number" value={kTarget} onChange={e => setKTarget(e.target.value)} placeholder="e.g. 10" />
                  </CCol>
                </CRow>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Frequency</CFormLabel>
                  <CFormSelect value={kFreq} onChange={e => setKFreq(e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </CFormSelect>
                </div>
                <div className="mb-3">
                  <CFormLabel style={LBL}>Description</CFormLabel>
                  <CFormTextarea rows={2} value={kDesc} onChange={e => setKDesc(e.target.value)} placeholder="What does this KPI measure?" />
                </div>
                <CButton color="dark" onClick={handleCreateKPI} disabled={kpiMut.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                  {kpiMut.isPending ? <CSpinner size="sm" /> : 'Create KPI'}
                </CButton>
              </CCardBody>
            </CCard>
          )}

          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                KPI Definitions {kpiLoading ? <CSpinner size="sm" /> : `(${kpis.length})`}
              </div>
              {!kpiLoading && kpis.length === 0 && (
                <div style={{ padding: 24, color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center' }}>No KPIs defined yet.</div>
              )}
              {kpis.map(k => (
                <div key={k.id} style={ROW}>
                  <div style={{ fontWeight: 600 }}>{k.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                    <span>Target: {k.target_value} {k.metric_unit}</span>
                    <span>Freq: {k.frequency}</span>
                    {k.assigned_to_username && <span>Assigned: {k.assigned_to_username}</span>}
                  </div>
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Right ── */}
        <CCol lg={6}>
          <CCard className="mb-3">
            <CCardBody style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Log Daily Value</div>
              <div className="mb-3">
                <CFormLabel style={LBL}>KPI</CFormLabel>
                <CFormSelect value={selKPI} onChange={e => setSelKPI(e.target.value)}>
                  <option value="">— Select KPI —</option>
                  {kpis.map(k => <option key={k.id} value={k.id}>{k.title} (target: {k.target_value} {k.metric_unit})</option>)}
                </CFormSelect>
              </div>
              <CRow className="g-2 mb-3">
                <CCol xs={6}>
                  <CFormLabel style={LBL}>Value</CFormLabel>
                  <CFormInput type="number" value={eValue} onChange={e => setEValue(e.target.value)} placeholder="Actual value" />
                </CCol>
                <CCol xs={6}>
                  <CFormLabel style={LBL}>Date</CFormLabel>
                  <DateField value={eDate} onChange={v => setEDate(v)} />
                </CCol>
              </CRow>
              <div className="mb-3">
                <CFormLabel style={LBL}>Notes</CFormLabel>
                <CFormTextarea rows={2} value={eNotes} onChange={e => setENotes(e.target.value)} placeholder="Any context or notes…" />
              </div>
              <CButton color="dark" onClick={handleLog} disabled={entryMut.isPending} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
                {entryMut.isPending ? <CSpinner size="sm" /> : 'Log Value'}
              </CButton>
            </CCardBody>
          </CCard>

          <CCard>
            <CCardBody style={{ padding: 0 }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600 }}>
                Recent Entries {entryLoading && <CSpinner size="sm" />}
              </div>
              {!entryLoading && recent.length === 0 && (
                <div style={{ padding: 24, color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 13, textAlign: 'center' }}>No entries yet.</div>
              )}
              {recent.map((e, i) => {
                const met = e.target !== undefined && +e.value >= +e.target;
                return (
                  <div key={e.id ?? i} style={ROW}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, flex: 1 }}>{e.kpi_title}</span>
                      <span style={{ fontSize: 15, color: met ? 'var(--ok)' : 'var(--bad)' }}>{met ? '✓' : '✗'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ color: met ? 'var(--ok)' : 'var(--bad)', fontWeight: 600 }}>
                        {e.value} {e.metric_unit}
                      </span>
                      {e.target !== undefined && <span>/ {e.target} {e.metric_unit}</span>}
                      <span>{e.date}</span>
                    </div>
                    {e.notes && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3, fontStyle: 'italic' }}>{e.notes}</div>}
                  </div>
                );
              })}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
