import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../api/client';
import DateField from '../components/DateField';
import {
  getTasks, createTask, deleteTask,
  getAssignments, createAssignment, updateAssignment, deleteAssignment, addActivity,
  getBoardUsers,
} from '../api/taskboard';

const COLS_PER_PAGE = 6;

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS = {
  pending:     { label: 'Pending',     bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  in_progress: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  completed:   { label: 'Completed',   bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  blocked:     { label: 'Blocked',     bg: '#fff1f2', color: '#be123c', dot: '#f43f5e' },
};

const ACTIVITY_TYPES = [
  { value: 'action',  label: '⚡ Action Taken',   color: '#1d4ed8' },
  { value: 'support', label: '🤝 Support Given',   color: '#7c3aed' },
  { value: 'comment', label: '💬 Comment',         color: '#374151' },
  { value: 'close',   label: '✅ Close Task',      color: '#15803d' },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose, danger = true, busy = false }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1200 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1201, width:'min(420px,94vw)', background:'#fff', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,.25)', fontFamily:'var(--fm)', overflow:'hidden' }}>
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:17 }}>{title}</div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'var(--ink3)', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%' }}>✕</button>
        </div>
        <div style={{ padding:'18px 24px', fontSize:14, color:'var(--ink2)', lineHeight:1.6 }}>{message}</div>
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} disabled={busy} style={{ border:'1px solid var(--line)', borderRadius:20, padding:'8px 20px', fontSize:13, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--ink2)' }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            style={{ border:'none', borderRadius:20, padding:'8px 22px', fontSize:13, fontFamily:'var(--fb)', fontWeight:700, cursor:busy?'not-allowed':'pointer', background: danger ? '#dc2626' : 'var(--accent)', color:'#fff', opacity:busy?.7:1 }}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────────────────
function AddTaskModal({ onClose, onSave, saving, boardUsers }) {
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [err,        setErr]        = useState('');
  const [userQ,      setUserQ]      = useState('');
  const [unitFilter, setUnitFilter] = useState(''); // '' = all
  const [sel,        setSel]        = useState(new Set());

  const toggle = uid => setSel(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  // Derive unique units for filter chips
  const units = useMemo(() => {
    const seen = {};
    boardUsers.forEach(u => {
      if (u.unit_id && !seen[u.unit_id]) seen[u.unit_id] = { id: u.unit_id, abbr: u.unit_abbr || 'N/A', color: u.unit_color ?? '#6366f1' };
    });
    return Object.values(seen);
  }, [boardUsers]);

  // Apply unit filter + text search, then group by unit
  const groups = useMemo(() => {
    let list = boardUsers;
    if (unitFilter) list = list.filter(u => String(u.unit_id) === unitFilter);
    const lq = userQ.trim().toLowerCase();
    if (lq) list = list.filter(u => (u.name || u.username).toLowerCase().includes(lq));
    const g = {};
    list.forEach(u => {
      const k = u.unit_abbr || 'Other';
      if (!g[k]) g[k] = { abbr: k, color: u.unit_color ?? '#6366f1', users: [] };
      g[k].users.push(u);
    });
    return Object.values(g);
  }, [boardUsers, unitFilter, userQ]);

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1100 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1101, width:'min(600px,96vw)', maxHeight:'90vh', background:'#fff', borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,.25)', fontFamily:'var(--fm)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--line)', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:18 }}>New task column</div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'var(--ink3)', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%' }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {/* Task details */}
          <div style={{ padding:'20px 24px 0' }}>
            <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 }}>Task title *</label>
            <input value={title} onChange={e => { setTitle(e.target.value); setErr(''); }}
              placeholder="e.g. Data Migration, API Integration…"
              style={{ border:`1px solid ${err?'#dc2626':'var(--line)'}`, borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'var(--fm)', width:'100%', boxSizing:'border-box', outline:'none' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor=err?'#dc2626':'var(--line)'} />
            {err && <div style={{ fontSize:12, color:'#dc2626', marginTop:4 }}>⚠ {err}</div>}

            <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6, marginTop:16 }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What does this task involve…"
              style={{ border:'1px solid var(--line)', borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'var(--fm)', width:'100%', boxSizing:'border-box', outline:'none', resize:'none' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--line)'} />
          </div>

          {/* Divider */}
          <div style={{ margin:'18px 24px 0', borderTop:'1px solid var(--line)', paddingTop:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)' }}>Assign to team members</div>
                <div style={{ fontSize:11, color:'var(--ink3)', marginTop:2 }}>Optional · can also assign after creation</div>
              </div>
              {sel.size > 0 && (
                <span style={{ fontSize:11, fontWeight:700, color:'var(--accent)', background:'#eff6ff', borderRadius:6, padding:'3px 10px' }}>
                  {sel.size} selected
                </span>
              )}
            </div>

            {/* Unit filter chips */}
            {units.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                <button
                  onClick={() => setUnitFilter('')}
                  style={{ border:`1.5px solid ${!unitFilter ? 'var(--accent)' : 'var(--line)'}`, borderRadius:20, padding:'4px 13px', fontSize:12, fontFamily:'var(--fb)', fontWeight:!unitFilter ? 700 : 400, cursor:'pointer', background:!unitFilter ? 'var(--accent)' : '#fff', color:!unitFilter ? '#fff' : 'var(--ink2)' }}>
                  All teams
                </button>
                {units.map(u => {
                  const active = unitFilter === String(u.id);
                  return (
                    <button key={u.id} onClick={() => setUnitFilter(active ? '' : String(u.id))}
                      style={{ border:`1.5px solid ${active ? u.color : 'var(--line)'}`, borderRadius:20, padding:'4px 13px', fontSize:12, fontFamily:'var(--fb)', fontWeight:active ? 700 : 400, cursor:'pointer', background:active ? u.color : '#fff', color:active ? '#fff' : 'var(--ink2)', display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:active ? '#fff' : u.color, display:'inline-block', flexShrink:0 }} />
                      {u.abbr}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search */}
            <div style={{ position:'relative', marginBottom:10 }}>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="6.5" cy="6.5" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
              </svg>
              <input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search members…"
                style={{ width:'100%', boxSizing:'border-box', border:'1px solid var(--line)', borderRadius:8, padding:'8px 12px 8px 28px', fontSize:13, fontFamily:'var(--fm)', outline:'none', color:'var(--ink)' }}
                onFocus={e => e.target.style.borderColor='var(--accent)'}
                onBlur={e => e.target.style.borderColor='var(--line)'} />
              {userQ && <button onClick={() => setUserQ('')} style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'var(--ink3)', fontSize:14, padding:0 }}>✕</button>}
            </div>

            {/* User list */}
            <div style={{ border:'1px solid var(--line)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
              {groups.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', fontSize:13, color:'var(--ink3)' }}>No members found</div>
              ) : groups.map((g, gi) => (
                <div key={g.abbr}>
                  {gi > 0 && <div style={{ borderTop:'1px solid var(--line)' }} />}
                  <div style={{ padding:'8px 14px 4px', fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:g.color, display:'flex', alignItems:'center', gap:5, background:'#f8fafc' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:g.color, display:'inline-block' }} />{g.abbr}
                  </div>
                  {g.users.map(u => {
                    const checked = sel.has(u.id);
                    const name    = u.name || u.username;
                    return (
                      <label key={u.id} onClick={() => toggle(u.id)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', cursor:'pointer', background: checked ? '#eff6ff' : '#fff', transition:'background .1s', userSelect:'none', borderTop:'1px solid #f1f5f9' }}>
                        <div style={{ width:17, height:17, borderRadius:5, border:`2px solid ${checked ? 'var(--accent)' : 'var(--line)'}`, background: checked ? 'var(--accent)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .12s' }}>
                          {checked && <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>}
                        </div>
                        <div style={{ width:28, height:28, borderRadius:'50%', background: u.unit_color ?? 'var(--accent)', color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:'var(--fb)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{name}</div>
                          <div style={{ fontSize:10, color:'var(--ink3)' }}>
                            {u.unit_abbr && <span style={{ background:(u.unit_color??'#6366f1')+'22', color:u.unit_color??'#6366f1', borderRadius:3, padding:'1px 5px', fontWeight:700, fontSize:9, marginRight:4 }}>{u.unit_abbr}</span>}
                            {u.role}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:12, color:'var(--ink3)' }}>
            {sel.size > 0 ? `${sel.size} member${sel.size > 1 ? 's' : ''} will be assigned` : 'No members selected'}
          </span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ border:'1px solid var(--line)', borderRadius:20, padding:'9px 22px', fontSize:13, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--ink2)' }}>Cancel</button>
            <button
              onClick={() => { if (!title.trim()) { setErr('Title is required'); return; } onSave({ title: title.trim(), description: desc.trim() }, [...sel]); }}
              disabled={saving}
              style={{ border:'none', borderRadius:20, padding:'9px 26px', fontSize:13, fontFamily:'var(--fb)', fontWeight:700, cursor:saving?'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:saving?.7:1 }}>
              {saving ? 'Saving…' : sel.size > 0 ? `Create & assign (${sel.size})` : 'Create column'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Detail / Assignment Modal ─────────────────────────────────────────────────
function DetailModal({ task, user, assignment, onClose, onSaved }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const [status,    setStatus]    = useState(assignment?.status     ?? 'pending');
  const [startDate, setStartDate] = useState(assignment?.start_date ?? '');
  const [deadline,  setDeadline]  = useState(assignment?.deadline   ?? '');
  const [actType,   setActType]   = useState('action');
  const [actText,   setActText]   = useState('');
  const [supNeeded, setSupNeeded] = useState(false);
  const [addingAct, setAddingAct] = useState(false);

  const today = todayISO();
  const isOverdue = deadline && deadline < today && status !== 'completed';

  const saveMeta = useMutation({
    mutationFn: async () => {
      const payload = { task: task.id, assigned_to: user.id, status, start_date: startDate || null, deadline: deadline || null };
      if (assignment) return updateAssignment(assignment.id, payload);
      return createAssignment(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tb-assignments'] });
      toast('Saved');
      onSaved();
    },
    onError: err => toast(getErrorMessage(err)),
  });

  const removeAssignment = useMutation({
    mutationFn: () => deleteAssignment(assignment.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tb-assignments'] }); toast('Removed'); onClose(); },
    onError: err => toast(getErrorMessage(err)),
  });

  const submitActivity = async () => {
    if (!actText.trim()) return;
    setAddingAct(true);
    try {
      let aid = assignment?.id;
      if (!aid) {
        const created = await createAssignment({ task: task.id, assigned_to: user.id, status, start_date: startDate || null, deadline: deadline || null });
        aid = created.id;
      }
      await addActivity(aid, { text: actText.trim(), activity_type: actType, support_needed: supNeeded });
      qc.invalidateQueries({ queryKey: ['tb-assignments'] });
      setActText(''); setSupNeeded(false);
      toast('Activity recorded');
      onSaved();
    } catch(e) { toast(getErrorMessage(e)); }
    finally { setAddingAct(false); }
  };

  const activities = assignment?.activities ?? [];
  const actTypeColors = { action:'#1d4ed8', support:'#7c3aed', comment:'#374151', close:'#15803d' };
  const actTypeBg    = { action:'#eff6ff', support:'#f5f3ff', comment:'#f9fafb', close:'#f0fdf4' };
  const actTypeLabel = { action:'Action', support:'Support', comment:'Comment', close:'Closed' };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1100 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1101, width:'min(680px,96vw)', maxHeight:'92vh', background:'#fff', borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,.28)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'var(--fm)' }}>

        {/* Header */}
        <div style={{ padding:'18px 24px 14px', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:18, color:'var(--ink)', marginBottom:4 }}>{task.title}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:24, height:24, borderRadius:'50%', background: user.unit_color ?? 'var(--accent)', color:'#fff', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </span>
                <span style={{ fontFamily:'var(--fb)', fontWeight:600, fontSize:14, color:'var(--ink)' }}>{user.name || user.username}</span>
                {user.unit_abbr && <span style={{ fontSize:11, fontWeight:700, color:'#fff', background: user.unit_color ?? 'var(--accent)', borderRadius:4, padding:'2px 7px' }}>{user.unit_abbr}</span>}
                {isOverdue && <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'#dc2626', borderRadius:4, padding:'2px 7px' }}>⚠ OVERDUE</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ border:'none', background:'rgba(0,0,0,.07)', cursor:'pointer', width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink2)', fontSize:18, flexShrink:0 }}>✕</button>
          </div>
          {task.description && <div style={{ marginTop:8, fontSize:13, color:'var(--ink3)', lineHeight:1.5 }}>{task.description}</div>}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {/* Status + dates */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ border:'1px solid var(--line)', borderRadius:8, padding:'8px 10px', fontSize:13, fontFamily:'var(--fm)', width:'100%', cursor:'pointer', outline:'none', color: STATUS[status]?.color, fontWeight:600, background: STATUS[status]?.bg }}
                onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--line)'}>
                {Object.entries(STATUS).map(([v, {label}]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 }}>Start date</label>
              <DateField value={startDate} onChange={setStartDate} placeholder="From" style={{ display:'block' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', display:'block', marginBottom:6 }}>Deadline</label>
              <DateField value={deadline} onChange={setDeadline} placeholder="Due date" style={{ display:'block', borderColor: isOverdue ? '#dc2626' : undefined }} />
            </div>
          </div>

          {/* Timeline bar */}
          {startDate && deadline && (
            <div style={{ marginBottom:20, padding:'12px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid var(--line)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:'var(--ink3)', fontWeight:600 }}>
                <span>📅 {startDate}</span>
                <span style={{ color: isOverdue ? '#dc2626' : 'var(--ink3)' }}>🏁 {deadline}</span>
              </div>
              {(() => {
                const s = new Date(startDate + 'T00:00:00');
                const e = new Date(deadline + 'T00:00:00');
                const now = new Date();
                const total = e - s;
                const elapsed = Math.min(Math.max(now - s, 0), total);
                const pct = total > 0 ? Math.round(elapsed / total * 100) : 0;
                return (
                  <div style={{ height:6, background:'var(--line)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: isOverdue ? '#dc2626' : status === 'completed' ? '#22c55e' : 'var(--accent)', borderRadius:99, transition:'width .3s' }} />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Activity log */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:10 }}>Activity log</div>
            {activities.length === 0 && (
              <div style={{ fontSize:13, color:'var(--ink3)', fontStyle:'italic', padding:'10px 0' }}>No activities yet — add the first one below.</div>
            )}
            {activities.map(act => (
              <div key={act.id} style={{ display:'flex', gap:10, marginBottom:10 }}>
                <div style={{ flexShrink:0, width:8, marginTop:6, display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: actTypeColors[act.activity_type] ?? '#6366f1' }} />
                  <div style={{ width:1, flex:1, background:'var(--line)', marginTop:3 }} />
                </div>
                <div style={{ flex:1, background: actTypeBg[act.activity_type] ?? '#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:2 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:700, color: actTypeColors[act.activity_type], background:'#fff', border:`1px solid ${actTypeColors[act.activity_type]}30`, borderRadius:4, padding:'2px 7px', textTransform:'uppercase', letterSpacing:'.04em' }}>
                      {actTypeLabel[act.activity_type]}
                    </span>
                    {act.activity_type === 'close' && act.support_needed && (
                      <span style={{ fontSize:10, fontWeight:700, color:'#dc2626', background:'#fee2e2', borderRadius:4, padding:'2px 7px' }}>Further support needed</span>
                    )}
                    <span style={{ fontSize:11, color:'var(--ink3)', marginLeft:'auto' }}>{act.created_by_name} · {new Date(act.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.5 }}>{act.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Add activity */}
          <div style={{ border:'1px solid var(--line)', borderRadius:10, padding:'14px 16px', background:'#fafbfc' }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:10 }}>Add activity</div>
            <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              {ACTIVITY_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setActType(t.value)}
                  style={{ border:`1.5px solid ${actType===t.value ? t.color : 'var(--line)'}`, borderRadius:20, padding:'5px 14px', fontSize:12, fontFamily:'var(--fb)', fontWeight:actType===t.value?700:500, cursor:'pointer', background:actType===t.value?t.color:'#fff', color:actType===t.value?'#fff':'var(--ink2)', transition:'all .12s' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea value={actText} onChange={e => setActText(e.target.value)} rows={3}
              placeholder={actType === 'action' ? 'Describe the action taken…' : actType === 'support' ? 'Describe the support given by which team…' : actType === 'close' ? 'Add closing remarks…' : 'Add a comment…'}
              style={{ border:'1px solid var(--line)', borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'var(--fm)', width:'100%', boxSizing:'border-box', outline:'none', resize:'vertical', marginBottom: actType==='close'?10:0 }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--line)'} />
            {actType === 'close' && (
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer', marginBottom:10 }}>
                <input type="checkbox" checked={supNeeded} onChange={e => setSupNeeded(e.target.checked)} style={{ width:15, height:15, cursor:'pointer' }} />
                <span style={{ color: supNeeded ? '#dc2626' : 'var(--ink2)', fontWeight: supNeeded ? 600 : 400 }}>Further support is needed</span>
              </label>
            )}
            <button onClick={submitActivity} disabled={addingAct || !actText.trim()}
              style={{ border:'none', borderRadius:20, padding:'8px 22px', fontSize:13, fontFamily:'var(--fb)', fontWeight:700, cursor: (addingAct||!actText.trim()) ? 'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:(addingAct||!actText.trim())?.6:1 }}>
              {addingAct ? 'Saving…' : 'Post activity'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, background:'#fff' }}>
          <div>
            {assignment && (
              <button onClick={() => { if (window.confirm('Remove this assignment?')) removeAssignment.mutate(); }}
                style={{ border:'1px solid #fca5a5', borderRadius:8, padding:'7px 14px', fontSize:12, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff5f5', color:'#dc2626' }}>
                Remove assignment
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ border:'1px solid var(--line)', borderRadius:20, padding:'9px 22px', fontSize:13, fontFamily:'var(--fb)', cursor:'pointer', background:'#fff', color:'var(--ink2)' }}>Close</button>
            <button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}
              style={{ border:'none', borderRadius:20, padding:'9px 26px', fontSize:13, fontFamily:'var(--fb)', fontWeight:700, cursor:saveMeta.isPending?'not-allowed':'pointer', background:'var(--accent)', color:'#fff', opacity:saveMeta.isPending?.7:1 }}>
              {saveMeta.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Status cell ────────────────────────────────────────────────────────────────
const ACT_LABEL = { action:'Action', support:'Support', comment:'Comment', close:'Closed' };
const ACT_COLOR = { action:'#1d4ed8', support:'#7c3aed', comment:'#64748b', close:'#15803d' };

function Cell({ assignment, onClick }) {
  if (!assignment) {
    return (
      <td onClick={onClick}
        style={{ border:'1px solid var(--line)', minWidth:130, height:52, textAlign:'center', cursor:'pointer', background:'#fafbfc', transition:'background .12s', verticalAlign:'middle' }}
        onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.background='#fafbfc'}>
        <span style={{ fontSize:18, color:'var(--line)', opacity:.4 }}>＋</span>
      </td>
    );
  }
  const today = todayISO();
  const isOverdue = assignment.deadline && assignment.deadline < today && assignment.status !== 'completed';
  const st = isOverdue ? { label:'Overdue', bg:'#fff1f2', color:'#be123c', dot:'#f43f5e' } : STATUS[assignment.status] ?? STATUS.pending;
  const acts = assignment.activities ?? [];
  const lastAct = acts.length > 0 ? acts[acts.length - 1] : null;

  return (
    <td onClick={onClick}
      style={{ border:'1px solid var(--line)', minWidth:130, textAlign:'center', cursor:'pointer', background: st.bg, transition:'filter .12s', verticalAlign:'middle' }}
      onMouseEnter={e => e.currentTarget.style.filter='brightness(.96)'}
      onMouseLeave={e => e.currentTarget.style.filter='none'}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'7px 8px' }}>
        {/* Status */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:st.dot, flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight:700, color:st.color }}>{st.label}</span>
        </div>
        {/* Deadline */}
        {assignment.deadline && (
          <span style={{ fontSize:10, color: isOverdue ? '#dc2626' : 'var(--ink3)', fontWeight: isOverdue ? 700 : 400 }}>
            {isOverdue ? '⚠ ' : ''}{assignment.deadline}
          </span>
        )}
        {/* Activity summary */}
        {acts.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginTop:1, width:'100%' }}>
            <span style={{ fontSize:9, color:'var(--ink3)', fontWeight:500 }}>
              {acts.length} {acts.length === 1 ? 'item' : 'items'}
            </span>
            {lastAct && (
              <span style={{ fontSize:9, fontWeight:700, color: ACT_COLOR[lastAct.activity_type] ?? 'var(--ink3)', background:'#fff', borderRadius:3, padding:'1px 5px', maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {ACT_LABEL[lastAct.activity_type]}: {lastAct.text}
              </span>
            )}
          </div>
        )}
      </div>
    </td>
  );
}

// ── Trash icon ─────────────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ display:'block' }}>
      <path d="M2 4h12M6 4V2h4v2M5 4l.5 9h5L11 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TaskBoardPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const [showAddTask,    setShowAddTask]    = useState(false);
  const [detailCell,     setDetailCell]     = useState(null);   // { task, user, assignment }
  const [confirmDelete,  setConfirmDelete]  = useState(null);   // task object
  const [filterUnit,     setFilterUnit]     = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [searchQ,        setSearchQ]        = useState('');
  const [taskPage,       setTaskPage]       = useState(1);      // 1-based

  const { data: tasks       = [], isLoading: tasksLoading }  = useQuery({ queryKey: ['tb-tasks'],       queryFn: getTasks });
  const { data: boardUsers  = [], isLoading: usersLoading }  = useQuery({ queryKey: ['tb-users'],       queryFn: getBoardUsers });
  const { data: assignments = [], isLoading: assignLoading } = useQuery({ queryKey: ['tb-assignments'], queryFn: getAssignments });

  // Build lookup: `${task_id}-${user_id}` → assignment
  const assignMap = useMemo(() => {
    const m = {};
    assignments.forEach(a => { m[`${a.task}-${a.assigned_to}`] = a; });
    return m;
  }, [assignments]);

  // Unique units for filter chips
  const units = useMemo(() => {
    const seen = {};
    boardUsers.forEach(u => { if (u.unit_id) seen[u.unit_id] = { id: u.unit_id, abbr: u.unit_abbr, color: u.unit_color }; });
    return Object.values(seen);
  }, [boardUsers]);

  // Filtered user rows (by unit + status only — search is for columns)
  const visibleUsers = useMemo(() => {
    let list = boardUsers;
    if (filterUnit)   list = list.filter(u => String(u.unit_id) === filterUnit);
    if (filterStatus) list = list.filter(u => tasks.some(t => assignMap[`${t.id}-${u.id}`]?.status === filterStatus));
    return list;
  }, [boardUsers, filterUnit, filterStatus, tasks, assignMap]);

  // Filtered + searched task columns
  const filteredTasks = useMemo(() => {
    if (!searchQ.trim()) return tasks;
    const q = searchQ.trim().toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [tasks, searchQ]);

  // Column pagination (applied to filteredTasks)
  const totalPages   = Math.max(1, Math.ceil(filteredTasks.length / COLS_PER_PAGE));
  const safePage     = Math.min(taskPage, totalPages);
  const visibleTasks = filteredTasks.slice((safePage - 1) * COLS_PER_PAGE, safePage * COLS_PER_PAGE);

  const addTaskMutation = useMutation({
    mutationFn: async ({ taskData, userIds }) => {
      const task = await createTask(taskData);
      if (userIds.length > 0) {
        await Promise.all(userIds.map(uid => createAssignment({ task: task.id, assigned_to: uid })));
      }
      return task;
    },
    onSuccess: (_, { userIds }) => {
      qc.invalidateQueries({ queryKey: ['tb-tasks'] });
      qc.invalidateQueries({ queryKey: ['tb-assignments'] });
      setShowAddTask(false);
      toast(userIds.length > 0 ? `Column created & assigned to ${userIds.length} member${userIds.length > 1 ? 's' : ''}` : 'Task column added');
      const newTotal = tasks.length + 1;
      setTaskPage(Math.ceil(newTotal / COLS_PER_PAGE));
    },
    onError: err => toast(getErrorMessage(err)),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => deleteTask(confirmDelete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tb-tasks'] });
      qc.invalidateQueries({ queryKey: ['tb-assignments'] });
      toast('Column deleted');
      setConfirmDelete(null);
      // If we deleted the only task on the last page, go back one
      if (visibleTasks.length === 1 && safePage > 1) setTaskPage(safePage - 1);
    },
    onError: err => { toast(getErrorMessage(err)); setConfirmDelete(null); },
  });

  const isLoading = tasksLoading || usersLoading || assignLoading;

  // Summary counts
  const completed = assignments.filter(a => a.status === 'completed').length;
  const overdue   = assignments.filter(a => a.deadline && a.deadline < todayISO() && a.status !== 'completed').length;

  return (
    <>
      {/* Filter bar */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Task Board</div>
          <div className="v">Team task matrix</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Search columns */}
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ position:'absolute', left:10, pointerEvents:'none' }}>
              <circle cx="6.5" cy="6.5" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
            </svg>
            <input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setTaskPage(1); }}
              placeholder="Search columns…"
              style={{ border:'1px solid var(--line)', borderRadius:20, padding:'6px 14px 6px 30px', fontSize:13, fontFamily:'var(--fm)', outline:'none', background:'#fff', color:'var(--ink)', width:160 }}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e => e.target.style.borderColor='var(--line)'}
            />
            {searchQ && (
              <button onClick={() => setSearchQ('')} style={{ position:'absolute', right:10, border:'none', background:'none', cursor:'pointer', color:'var(--ink3)', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
            )}
          </div>
          {/* Unit filter */}
          <div className="seg">
            <button className={!filterUnit ? 'on' : ''} onClick={() => setFilterUnit('')}>All units</button>
            {units.map(u => (
              <button key={u.id} className={filterUnit === String(u.id) ? 'on' : ''} onClick={() => setFilterUnit(String(u.id))}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:u.color, display:'inline-block', marginRight:5 }} />{u.abbr}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ border:'1px solid var(--line)', borderRadius:20, padding:'6px 14px', fontSize:13, fontFamily:'var(--fb)', cursor:'pointer', outline:'none', background:'#fff', color:'var(--ink)' }}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
          </select>
          {/* Common add column button */}
          <button onClick={() => setShowAddTask(true)}
            style={{ border:'none', borderRadius:20, padding:'7px 18px', fontSize:13, fontFamily:'var(--fb)', fontWeight:700, cursor:'pointer', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> Add column
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total tasks',  value: tasks.length,     color:'var(--accent)', bg:'#eff6ff' },
          { label:'Assigned',     value: assignments.length, color:'#1d4ed8',     bg:'#eff6ff' },
          { label:'Completed',    value: completed,          color:'#15803d',     bg:'#f0fdf4' },
          { label:'Overdue',      value: overdue,            color:'#dc2626',     bg:'#fff1f2' },
        ].map(c => (
          <div key={c.label} style={{ border:'1px solid var(--line)', borderRadius:12, padding:'14px 18px', background: (overdue>0&&c.label==='Overdue') || (completed>0&&c.label==='Completed') ? c.bg : '#fff' }}>
            <div style={{ fontFamily:'var(--fm)', fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, color: (overdue>0&&c.label==='Overdue') || (completed>0&&c.label==='Completed') ? c.color : 'var(--ink)', lineHeight:1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div style={{ background:'#fff', border:'1px solid var(--line)', borderRadius:12, overflow:'hidden' }}>
        {isLoading ? (
          <div style={{ padding:'60px', textAlign:'center', color:'var(--ink3)', fontSize:14 }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
            <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:18, color:'var(--ink)', marginBottom:8 }}>No tasks yet</div>
            <div style={{ fontFamily:'var(--fm)', fontSize:13, color:'var(--ink3)', marginBottom:20 }}>Add your first task column to get started</div>
            <button onClick={() => setShowAddTask(true)}
              style={{ border:'none', borderRadius:20, padding:'10px 28px', fontSize:14, fontFamily:'var(--fb)', fontWeight:700, cursor:'pointer', background:'var(--accent)', color:'#fff' }}>
              + Add task column
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', width:'100%', minWidth: 200 + visibleTasks.length * 120 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'2px solid var(--line)' }}>
                    {/* User col header */}
                    <th style={{ padding:'12px 16px', textAlign:'left', fontFamily:'var(--fb)', fontSize:12, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--ink3)', minWidth:180, position:'sticky', left:0, background:'#f8fafc', zIndex:2, borderRight:'1px solid var(--line)' }}>
                      Team member
                      {visibleUsers.length !== boardUsers.length && (
                        <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:'var(--ink3)', background:'var(--line)', borderRadius:10, padding:'1px 7px' }}>
                          {visibleUsers.length}/{boardUsers.length}
                        </span>
                      )}
                    </th>
                    {/* Task column headers */}
                    {visibleTasks.map(t => (
                      <th key={t.id} style={{ padding:'10px 14px', textAlign:'center', fontFamily:'var(--fb)', fontSize:12, fontWeight:700, color:'var(--ink)', minWidth:130, borderRight:'1px solid var(--line)', verticalAlign:'middle' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{t.title}</span>
                            <button
                              onClick={() => setConfirmDelete(t)}
                              title="Delete column"
                              style={{ border:'none', background:'transparent', cursor:'pointer', color:'#94a3b8', padding:'2px 3px', borderRadius:4, display:'flex', alignItems:'center', lineHeight:1, flexShrink:0 }}
                              onMouseEnter={e => { e.currentTarget.style.color='#dc2626'; e.currentTarget.style.background='#fee2e2'; }}
                              onMouseLeave={e => { e.currentTarget.style.color='#94a3b8'; e.currentTarget.style.background='transparent'; }}>
                              <TrashIcon />
                            </button>
                          </div>
                          {t.description && (
                            <div style={{ fontSize:10, color:'var(--ink3)', fontWeight:400, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</div>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length === 0 ? (
                    <tr><td colSpan={visibleTasks.length + 2} style={{ padding:'40px', textAlign:'center', color:'var(--ink3)', fontSize:13 }}>No members match your search or filter.</td></tr>
                  ) : visibleUsers.map((u, ri) => (
                    <tr key={u.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      {/* User cell */}
                      <td style={{ padding:'10px 16px', borderRight:'1px solid var(--line)', position:'sticky', left:0, background: ri % 2 === 0 ? '#fff' : '#fafbfc', zIndex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background: u.unit_color ?? 'var(--accent)', color:'#fff', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {(u.name || u.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontFamily:'var(--fb)', fontWeight:600, fontSize:13, color:'var(--ink)' }}>{u.name || u.username}</div>
                            <div style={{ fontSize:11, color:'var(--ink3)' }}>
                              {u.unit_abbr && <span style={{ background: u.unit_color + '22', color: u.unit_color, borderRadius:3, padding:'1px 5px', fontWeight:700, fontSize:10, marginRight:4 }}>{u.unit_abbr}</span>}
                              {u.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Task cells */}
                      {visibleTasks.map(t => {
                        const assignment = assignMap[`${t.id}-${u.id}`] ?? null;
                        return <Cell key={t.id} assignment={assignment} onClick={() => setDetailCell({ task: t, user: u, assignment })} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid var(--line)', background:'#f8fafc' }}>
                <div style={{ fontSize:12, color:'var(--ink3)', fontFamily:'var(--fm)' }}>
                  Showing columns {(safePage - 1) * COLS_PER_PAGE + 1}–{Math.min(safePage * COLS_PER_PAGE, tasks.length)} of {tasks.length}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button
                    onClick={() => setTaskPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    style={{ border:'1px solid var(--line)', borderRadius:8, padding:'5px 14px', fontSize:13, fontFamily:'var(--fb)', cursor:safePage===1?'not-allowed':'pointer', background:'#fff', color:'var(--ink2)', opacity:safePage===1?.4:1 }}>
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setTaskPage(p)}
                      style={{ border:`1px solid ${p===safePage?'var(--accent)':'var(--line)'}`, borderRadius:8, padding:'5px 12px', fontSize:13, fontFamily:'var(--fb)', fontWeight:p===safePage?700:400, cursor:'pointer', background:p===safePage?'var(--accent)':'#fff', color:p===safePage?'#fff':'var(--ink2)', minWidth:34 }}>
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setTaskPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    style={{ border:'1px solid var(--line)', borderRadius:8, padding:'5px 14px', fontSize:13, fontFamily:'var(--fb)', cursor:safePage===totalPages?'not-allowed':'pointer', background:'#fff', color:'var(--ink2)', opacity:safePage===totalPages?.4:1 }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddTask && (
        <AddTaskModal
          onClose={() => setShowAddTask(false)}
          onSave={(taskData, userIds) => addTaskMutation.mutate({ taskData, userIds })}
          saving={addTaskMutation.isPending}
          boardUsers={boardUsers}
        />
      )}

      {detailCell && (
        <DetailModal
          task={detailCell.task}
          user={detailCell.user}
          assignment={detailCell.assignment}
          onClose={() => setDetailCell(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['tb-assignments'] }); setDetailCell(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete task column"
          message={<>Are you sure you want to delete the column <strong>"{confirmDelete.title}"</strong>? This will permanently remove all assignments and activity logs associated with it.</>}
          confirmLabel="Delete column"
          busy={deleteTaskMutation.isPending}
          onConfirm={() => deleteTaskMutation.mutate()}
          onClose={() => !deleteTaskMutation.isPending && setConfirmDelete(null)}
        />
      )}
    </>
  );
}
