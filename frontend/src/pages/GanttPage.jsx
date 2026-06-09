import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGanttTasks, createGanttTask, deleteGanttTask } from '../api/gantt';
import { getUnits } from '../api/units';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import DateField from '../components/DateField';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormSelect, CFormTextarea,
  CRow, CCol, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CSpinner,
} from '@coreui/react';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PRESET_COLORS = ['#378ADD', '#1D9E75', '#E0A21C', '#D85A30', '#8C6BE0'];
const LBL = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 4 };

/* Academic year helpers */
function academicYearFromDate(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth(); // 0-based
  const y = d.getFullYear();
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function ayStart(ay) {
  const y = parseInt(ay.split('-')[0]);
  return new Date(y, 3, 1); // April 1
}

function ayEnd(ay) {
  const y = parseInt(ay.split('-')[1]);
  return new Date(y, 2, 31); // March 31
}

function pct(dateStr, ay) {
  const start = ayStart(ay).getTime();
  const end   = ayEnd(ay).getTime();
  const d     = new Date(dateStr).getTime();
  return Math.min(100, Math.max(0, ((d - start) / (end - start)) * 100));
}

function currentAY() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export default function GanttPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const qc       = useQueryClient();
  const isAdmin   = user?.role === 'admin';
  const canCreate = user?.role === 'admin' || user?.is_team_lead;

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ['gantt'], queryFn: getGanttTasks });
  const { data: units = [] }            = useQuery({ queryKey: ['units'], queryFn: getUnits });

  /* Derive academic years from tasks */
  const years = useMemo(() => {
    if (!tasks.length) return [currentAY()];
    const set = new Set();
    tasks.forEach(t => {
      if (t.start_date) set.add(academicYearFromDate(t.start_date));
      if (t.end_date)   set.add(academicYearFromDate(t.end_date));
    });
    return [...set].sort().reverse();
  }, [tasks]);

  const [selYear, setSelYear]   = useState(() => currentAY());
  const [tooltip, setTooltip]   = useState(null);  // { task, x, y }
  const [showModal, setShowModal] = useState(false);
  const tooltipRef = useRef(null);

  /* Filtered tasks */
  const filtered = useMemo(() =>
    tasks.filter(t => {
      const ay = t.start_date ? academicYearFromDate(t.start_date) : null;
      return ay === selYear || (t.end_date && academicYearFromDate(t.end_date) === selYear);
    }),
    [tasks, selYear]
  );

  /* Group: parent tasks + their children */
  const grouped = useMemo(() => {
    const parents = filtered.filter(t => !t.parent);
    const result = [];
    parents.forEach(p => {
      result.push({ ...p, indent: 0 });
      filtered.filter(c => c.parent === p.id).forEach(c => result.push({ ...c, indent: 1 }));
    });
    // orphan children (parent not in filtered)
    filtered.filter(t => t.parent && !filtered.find(p => p.id === t.parent))
      .forEach(t => result.push({ ...t, indent: 0 }));
    return result;
  }, [filtered]);

  /* Create form */
  const [cTitle,  setCTitle]  = useState('');
  const [cUnit,   setCUnit]   = useState('');
  const [cStart,  setCStart]  = useState('');
  const [cEnd,    setCEnd]    = useState('');
  const [cProg,   setCProg]   = useState('0');
  const [cMile,   setCMile]   = useState(false);
  const [cColor,  setCColor]  = useState(PRESET_COLORS[0]);
  const [cDesc,   setCDesc]   = useState('');

  const createMut = useMutation({
    mutationFn: createGanttTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gantt'] });
      setCTitle(''); setCUnit(''); setCStart(''); setCEnd(''); setCProg('0'); setCMile(false); setCColor(PRESET_COLORS[0]); setCDesc('');
      setShowModal(false);
      toast('Task created');
    },
    onError: () => toast('Failed to create task'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteGanttTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gantt'] }); toast('Deleted'); },
    onError: () => toast('Failed to delete'),
  });

  const handleCreate = () => {
    if (!cTitle.trim()) { toast('Enter a title'); return; }
    if (!cStart || !cEnd) { toast('Set start and end dates'); return; }
    createMut.mutate({ title: cTitle, unit: cUnit || undefined, start_date: cStart, end_date: cEnd, progress: +cProg, milestone: cMile, color: cColor, description: cDesc, academic_year: academicYearFromDate(cStart) });
  };

  return (
    <>
      <div className="filterbar">
        <div className="period">
          <div className="l">Academic Year Gantt</div>
          <div className="v">Project timeline overview</div>
        </div>
        <div className="seg">
          {years.map(y => (
            <button key={y} className={selYear === y ? 'on' : ''} onClick={() => setSelYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      {/* Admin / team lead: create button */}
      {canCreate && (
        <div style={{ marginBottom: 16 }}>
          <CButton color="dark" size="sm" onClick={() => setShowModal(true)} style={{ fontFamily: 'var(--fb)', fontSize: 13 }}>
            + Add Task
          </CButton>
        </div>
      )}

      {/* Gantt chart */}
      <CCard>
        <CCardBody style={{ padding: 0, overflowX: 'auto' }}>
          {isLoading && (
            <div style={{ padding: 40, textAlign: 'center' }}><CSpinner color="dark" /></div>
          )}
          {!isLoading && (
            <div style={{ minWidth: 700 }}>
              {/* Header row — months */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 200, minWidth: 200, padding: '8px 14px', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', borderRight: '1px solid var(--line)' }}>
                  Task
                </div>
                <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                  {MONTHS.map((m, i) => (
                    <div key={m} style={{
                      flex: 1,
                      padding: '8px 4px',
                      fontFamily: 'var(--fm)',
                      fontSize: 10,
                      color: 'var(--ink3)',
                      textAlign: 'center',
                      borderRight: i < 11 ? '1px solid var(--line)' : 'none',
                    }}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Task rows */}
              {grouped.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>
                  No tasks for {selYear}.
                </div>
              )}
              {grouped.map((task, idx) => {
                const left  = pct(task.start_date, selYear);
                const right = pct(task.end_date,   selYear);
                const width = Math.max(0.5, right - left);
                const barColor = task.color ?? PRESET_COLORS[idx % PRESET_COLORS.length];
                const darkProg = `color-mix(in srgb, ${barColor} 60%, #000)`;

                return (
                  <div key={task.id} style={{ display: 'flex', borderBottom: '1px solid var(--line)', minHeight: 36 }}>
                    {/* Label */}
                    <div style={{
                      width: 200, minWidth: 200,
                      padding: '8px 14px',
                      paddingLeft: 14 + task.indent * 16,
                      fontFamily: 'var(--fm)',
                      fontSize: 12,
                      color: 'var(--ink)',
                      borderRight: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {task.milestone && <span style={{ color: barColor }}>◆</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    </div>

                    {/* Bar area */}
                    <div style={{ flex: 1, position: 'relative', padding: '6px 0' }}>
                      {task.milestone ? (
                        /* Diamond at end_date */
                        <div
                          title={task.title}
                          style={{
                            position: 'absolute',
                            left: `${right}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                            width: 14, height: 14,
                            background: barColor,
                            cursor: 'pointer',
                          }}
                          onClick={e => setTooltip({ task, x: e.clientX, y: e.clientY })}
                        />
                      ) : (
                        <div
                          onClick={e => setTooltip({ task, x: e.clientX, y: e.clientY })}
                          style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${width}%`,
                            top: 6, bottom: 6,
                            background: barColor,
                            borderRadius: 4,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            opacity: 0.9,
                          }}
                        >
                          {/* Progress fill */}
                          {task.progress > 0 && (
                            <div style={{
                              width: `${task.progress}%`,
                              height: '100%',
                              background: darkProg,
                            }} />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Admin delete */}
                    {isAdmin && (
                      <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={() => { if (window.confirm('Delete this task?')) deleteMut.mutate(task.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 14, padding: 4 }}
                          title="Delete"
                        >×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CCardBody>
      </CCard>

      {/* Tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          onClick={() => setTooltip(null)}
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 12, window.innerWidth - 220),
            top: tooltip.y + 12,
            background: 'var(--ink)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            zIndex: 9999,
            fontFamily: 'var(--fm)',
            fontSize: 12,
            maxWidth: 220,
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'var(--fd)' }}>{tooltip.task.title}</div>
          <div style={{ opacity: .7, marginBottom: 3 }}>{tooltip.task.start_date} → {tooltip.task.end_date}</div>
          {tooltip.task.progress !== undefined && <div>Progress: {tooltip.task.progress}%</div>}
          {tooltip.task.description && <div style={{ marginTop: 6, opacity: .8 }}>{tooltip.task.description}</div>}
          <div style={{ marginTop: 8, fontSize: 10, opacity: .5 }}>Click to close</div>
        </div>
      )}

      {/* Create Modal */}
      <CModal visible={showModal} onClose={() => setShowModal(false)} size="lg" alignment="center">
        <CModalHeader>
          <CModalTitle style={{ fontFamily: 'var(--fd)' }}>Add Gantt Task</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel style={LBL}>Title</CFormLabel>
            <CFormInput value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="Task title" />
          </div>
          <CRow className="g-2 mb-3">
            <CCol xs={6}>
              <CFormLabel style={LBL}>Unit</CFormLabel>
              <CFormSelect value={cUnit} onChange={e => setCUnit(e.target.value)}>
                <option value="">— Any —</option>
                {units.map(u => <option key={u.id ?? u.slug} value={u.id ?? u.slug}>{u.name}</option>)}
              </CFormSelect>
            </CCol>
            <CCol xs={3}>
              <CFormLabel style={LBL}>Start Date</CFormLabel>
              <DateField value={cStart} onChange={v => setCStart(v)} />
            </CCol>
            <CCol xs={3}>
              <CFormLabel style={LBL}>End Date</CFormLabel>
              <DateField value={cEnd} onChange={v => setCEnd(v)} />
            </CCol>
          </CRow>
          <CRow className="g-2 mb-3">
            <CCol xs={4}>
              <CFormLabel style={LBL}>Progress (%)</CFormLabel>
              <CFormInput type="number" min="0" max="100" value={cProg} onChange={e => setCProg(e.target.value)} />
            </CCol>
            <CCol xs={4}>
              <CFormLabel style={LBL}>Color</CFormLabel>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setCColor(c)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: c,
                    border: cColor === c ? '3px solid var(--ink)' : '2px solid transparent',
                    cursor: 'pointer',
                  }} />
                ))}
              </div>
            </CCol>
            <CCol xs={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 13 }}>
                <input type="checkbox" checked={cMile} onChange={e => setCMile(e.target.checked)} />
                Milestone ◆
              </label>
            </CCol>
          </CRow>
          <div className="mb-3">
            <CFormLabel style={LBL}>Description</CFormLabel>
            <CFormTextarea rows={2} value={cDesc} onChange={e => setCDesc(e.target.value)} placeholder="Optional details…" />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setShowModal(false)}>Cancel</CButton>
          <CButton color="dark" onClick={handleCreate} disabled={createMut.isPending} style={{ fontFamily: 'var(--fb)' }}>
            {createMut.isPending ? <CSpinner size="sm" /> : 'Create'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
}
