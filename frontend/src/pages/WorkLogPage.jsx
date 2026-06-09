import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, createTask, transitionTask } from '../api/worklog';
import { useToast } from '../context/ToastContext';
import DateField from '../components/DateField';
import {
  CCard, CCardBody, CButton,
  CFormLabel, CFormInput, CFormSelect, CSpinner,
  CRow, CCol, CBadge,
} from '@coreui/react';

const LBL = { fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', marginBottom: 8 };

function priorityColor(p) {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  return 'secondary';
}

function calcHours(startedAt) {
  if (!startedAt) return '';
  const diff = (Date.now() - new Date(startedAt).getTime()) / 3600000;
  return Math.max(0, diff).toFixed(1);
}

function TaskCard({ task, onTransition, onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.deadline && task.deadline < today && task.status !== 'done';
  const [doneOpen, setDoneOpen] = useState(false);
  const [hours, setHours] = useState(() => calcHours(task.started_at));

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--line)',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 10,
      fontFamily: 'var(--fm)',
    }}>
      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', marginBottom: 6 }}>{task.title}</div>

      {/* Badges row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <CBadge color={priorityColor(task.priority)} style={{ fontSize: 10 }}>
          {task.priority}
        </CBadge>
      </div>

      {/* Deadline */}
      {task.deadline && (
        <div style={{ fontSize: 11, color: isOverdue ? 'var(--bad)' : 'var(--ink3)', marginBottom: 5 }}>
          {isOverdue ? '⚠ Overdue: ' : 'Due: '}{task.deadline?.slice(0,10)}
        </div>
      )}

      {/* In Progress: started time */}
      {task.status === 'in_progress' && task.started_at && (
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 5 }}>
          Started: {new Date(task.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Done: hours taken */}
      {task.status === 'done' && task.hours_taken != null && (
        <div style={{ fontSize: 11, color: 'var(--ok)', marginBottom: 5 }}>
          ⏱ {task.hours_taken}h
        </div>
      )}

      {/* Done confirm inline form */}
      {doneOpen && (
        <div style={{ background: 'var(--paper)', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid var(--line)' }}>
          <CFormLabel style={LBL}>Hours taken:</CFormLabel>
          <CFormInput
            type="number" min="0" step="0.25"
            value={hours}
            onChange={e => setHours(e.target.value)}
            style={{ marginBottom: 8, fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <CButton size="sm" color="dark"
              onClick={() => { onDone(task.id, parseFloat(hours) || undefined); setDoneOpen(false); }}
              style={{ fontFamily: 'var(--fb)', fontSize: 12 }}
            >Mark Done</CButton>
            <CButton size="sm" color="secondary" variant="outline"
              onClick={() => setDoneOpen(false)}
              style={{ fontFamily: 'var(--fb)', fontSize: 12 }}
            >Cancel</CButton>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
        {task.status === 'todo' && (
          <CButton size="sm" color="info"
            onClick={() => onTransition(task.id, 'in_progress')}
            style={{ fontFamily: 'var(--fb)', fontSize: 11 }}
          >▶ Start</CButton>
        )}
        {task.status === 'in_progress' && !doneOpen && (
          <CButton size="sm" color="success"
            onClick={() => { setHours(calcHours(task.started_at)); setDoneOpen(true); }}
            style={{ fontFamily: 'var(--fb)', fontSize: 11 }}
          >✓ Done</CButton>
        )}
        {task.status === 'done' && (
          <CButton size="sm" color="secondary" variant="outline"
            onClick={() => onTransition(task.id, 'todo')}
            style={{ fontFamily: 'var(--fb)', fontSize: 11 }}
          >↺ Reopen</CButton>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ title, tasks, color, onTransition, onDone, showCreate, onCreate }) {
  return (
    <div style={{
      background: 'var(--paper)',
      borderRadius: 12,
      padding: '14px 12px',
      minHeight: 400,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{title}</span>
        <span style={{
          marginLeft: 'auto',
          background: 'var(--line)',
          borderRadius: 20,
          padding: '1px 8px',
          fontSize: 11,
          fontFamily: 'var(--fm)',
          color: 'var(--ink3)',
        }}>{tasks.length}</span>
      </div>

      {/* Task cards */}
      <div style={{ flex: 1 }}>
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onTransition={onTransition} onDone={onDone} />
        ))}
        {tasks.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink3)', fontFamily: 'var(--fm)', textAlign: 'center', padding: '20px 0', opacity: .7 }}>
            No tasks
          </div>
        )}
      </div>

      {/* Create button at bottom of To Do */}
      {showCreate && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={onCreate}
            style={{
              width: '100%',
              border: '1px dashed var(--line)',
              borderRadius: 8,
              padding: '8px',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--fm)',
              fontSize: 12,
              color: 'var(--ink3)',
            }}
          >+ New Task</button>
        </div>
      )}
    </div>
  );
}

export default function WorkLogPage() {
  const toast = useToast();
  const qc       = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
  });

  /* Group by status */
  const todo       = tasks.filter(t => t.status === 'todo');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const done       = tasks.filter(t => t.status === 'done');

  /* Transition mutation */
  const transitionMut = useMutation({
    mutationFn: ({ id, status, hours }) => transitionTask(id, status, hours),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: () => toast('Action failed'),
  });

  const handleTransition = (id, status) => transitionMut.mutate({ id, status });
  const handleDone       = (id, hours)  => transitionMut.mutate({ id, status: 'done', hours });

  /* Create task form */
  const [createOpen, setCreateOpen] = useState(false);
  const [cTitle,    setCTitle]    = useState('');
  const [cPriority, setCPriority] = useState('normal');
  const [cDeadline, setCDeadline] = useState('');

  const createMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setCTitle(''); setCPriority('normal'); setCDeadline('');
      setCreateOpen(false);
      toast('Task created');
    },
    onError: () => toast('Failed to create task'),
  });

  const handleCreate = () => {
    if (!cTitle.trim()) { toast('Enter a task title'); return; }
    createMut.mutate({ title: cTitle, priority: cPriority, deadline: cDeadline || undefined });
  };

  return (
    <>
      <div className="filterbar">
        <div className="period">
          <div className="l">Work Log</div>
          <div className="v">Daily task tracker</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CButton color="dark" size="sm"
            onClick={() => setCreateOpen(o => !o)}
            style={{ fontFamily: 'var(--fb)', fontSize: 13 }}
          >
            {createOpen ? '✕ Cancel' : '+ New Task'}
          </CButton>
        </div>
      </div>

      {/* Create form */}
      {createOpen && (
        <CCard className="mb-3">
          <CCardBody style={{ padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 600, marginBottom: 14 }}>New Task</div>
            <CRow className="g-2 align-items-end">
              <CCol xs={12} md={5}>
                <CFormLabel style={LBL}>Title</CFormLabel>
                <CFormInput
                  value={cTitle}
                  onChange={e => setCTitle(e.target.value)}
                  placeholder="Task title"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel style={LBL}>Priority</CFormLabel>
                <CFormSelect value={cPriority} onChange={e => setCPriority(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </CFormSelect>
              </CCol>
              <CCol xs={6} md={3}>
                <CFormLabel style={LBL}>Deadline</CFormLabel>
                <DateField value={cDeadline} onChange={v => setCDeadline(v)} />
              </CCol>
              <CCol xs={12} md={1}>
                <CButton
                  color="dark"
                  onClick={handleCreate}
                  disabled={createMut.isPending}
                  style={{ fontFamily: 'var(--fb)', fontSize: 13, width: '100%' }}
                >
                  {createMut.isPending ? <CSpinner size="sm" /> : 'Add'}
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <CSpinner color="dark" />
        </div>
      )}

      {/* Kanban board */}
      {!isLoading && (
        <CRow className="g-3">
          <CCol xs={12} md={4}>
            <KanbanColumn
              title="To Do"
              tasks={todo}
              color="var(--ink3)"
              onTransition={handleTransition}
              onDone={handleDone}
              showCreate
              onCreate={() => setCreateOpen(true)}
            />
          </CCol>
          <CCol xs={12} md={4}>
            <KanbanColumn
              title="In Progress"
              tasks={inProgress}
              color="var(--info)"
              onTransition={handleTransition}
              onDone={handleDone}
            />
          </CCol>
          <CCol xs={12} md={4}>
            <KanbanColumn
              title="Done"
              tasks={done}
              color="var(--ok)"
              onTransition={handleTransition}
              onDone={handleDone}
            />
          </CCol>
        </CRow>
      )}
    </>
  );
}
