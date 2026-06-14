import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMeetings, createMeeting, updateMeeting, cancelMeeting,
} from '../api/meetings';
import { getPairs } from '../api/units';
import { getLetters, uploadLetter } from '../api/documents';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import WeekCalendar from '../components/WeekCalendar';
import EventModal from '../components/EventModal';
import Badge from '../components/Badge';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt      = d => `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;

const STATUS_COLOR = {
  conducted:  '#1D9E75',
  scheduled:  '#378ADD',
  postponed:  '#E0A21C',
  missed:     '#D85A30',
  cancelled:  '#9ca3af',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMonday(d) {
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m    = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function minToTime(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Reason modal (for cancel / not-held reason) ───────────────────────────────
function ReasonModal({ meeting, action, onConfirm, onClose, saving }) {
  const [reason, setReason] = useState('');
  const A = meeting?.pair?.unit_a;
  const B = meeting?.pair?.unit_b;
  const label = A && B ? `${A.abbr} × ${B.abbr}` : 'this meeting';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1040 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1050, width: 'min(420px, 96vw)', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', textTransform: 'capitalize' }}>
            {action === 'cancel' ? 'Cancel' : 'Reason'} — {label}
          </span>
          <button onClick={onClose} type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink3)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)' }}>
            {action === 'cancel'
              ? `Please provide a reason for cancelling the ${label} meeting scheduled on ${meeting?.date}.`
              : `Provide a reason for rescheduling.`}
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            style={{ resize: 'none', border: '1px solid var(--line)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--fm)', color: 'var(--ink)', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} type="button" style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', background: 'var(--paper)', color: 'var(--ink2)' }}>
            Back
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={saving}
            type="button"
            style={{ border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: action === 'cancel' ? '#ef4444' : 'var(--accent)', color: '#fff', opacity: saving ? .7 : 1 }}
          >
            {saving ? 'Processing…' : action === 'cancel' ? 'Cancel meeting' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── D.O. Letters tab ──────────────────────────────────────────────────────────
function DOLettersTab({ user }) {
  const toast = useToast();
  const qc    = useQueryClient();
  const [filterMonth, setFilterMonth] = useState('');
  const [file,  setFile]  = useState(null);
  const [ftitle,setFtitle]= useState('');
  const fileRef = useRef();

  const { data: letters = [], isLoading } = useQuery({
    queryKey: ['do-letters'],
    queryFn: () => getLetters({}),
  });

  const uploadMutation = useMutation({
    mutationFn: (fd) => uploadLetter(fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['do-letters'] });
      setFile(null); setFtitle('');
      if (fileRef.current) fileRef.current.value = '';
      toast('Letter uploaded');
    },
    onError: () => toast('Upload failed'),
  });

  const canUpload = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'poc' || user?.role === 'team';

  const filtered = useMemo(() => {
    if (!filterMonth) return letters;
    return letters.filter(l => l.date?.startsWith(filterMonth));
  }, [letters, filterMonth]);

  const handleUpload = () => {
    if (!file) { toast('Select a file'); return; }
    const fd = new FormData();
    fd.append('file', file);
    if (ftitle.trim()) fd.append('title', ftitle.trim());
    uploadMutation.mutate(fd);
  };

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Upload form */}
      {canUpload && (
        <div style={{ flex: '0 0 300px', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Upload D.O. Letter</div>
          <div>
            <label style={{ fontFamily: 'var(--fm)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Title (optional)</label>
            <input
              type="text"
              value={ftitle}
              onChange={e => setFtitle(e.target.value)}
              placeholder="Letter title…"
              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 7, padding: '7px 10px', fontSize: 13, fontFamily: 'var(--fm)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--fm)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>File (PDF / DOC)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => setFile(e.target.files[0] || null)}
              style={{ fontSize: 12, fontFamily: 'var(--fm)', color: 'var(--ink2)', width: '100%' }}
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !file}
            style={{ border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 700, cursor: !file || uploadMutation.isPending ? 'not-allowed' : 'pointer', background: 'var(--accent)', color: '#fff', opacity: !file ? .5 : 1 }}
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload letter'}
          </button>
        </div>
      )}

      {/* Letters list */}
      <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>D.O. Letters ({filtered.length})</div>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontFamily: 'var(--fm)', color: 'var(--ink2)', outline: 'none' }}
          />
        </div>
        {isLoading && <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>Loading…</div>}
        {!isLoading && filtered.length === 0 && <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>No letters found.</div>}
        {filtered.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title || l.filename || 'Untitled'}</div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{l.date || ''}</div>
            </div>
            {l.file_url && (
              <a href={l.file_url} target="_blank" rel="noreferrer" style={{ border: '1px solid var(--accent)', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontFamily: 'var(--fm)', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const { user } = useAuth();
  const now   = new Date();

  const [view,      setView]      = useState('week');
  const [weekStart, setWeekStart] = useState(getMonday(now));
  const [calMonth,  setCalMonth]  = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selDay,    setSelDay]    = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  const [eventModal,  setEventModal]  = useState(null);  // { date, startMin, endMin, meeting? }
  const [reasonModal, setReasonModal] = useState(null);  // { meeting, action: 'cancel' }

  const { data: pairs    = [] } = useQuery({ queryKey: ['pairs'],    queryFn: getPairs });
  const { data: meetings = [] } = useQuery({ queryKey: ['meetings'], queryFn: () => getMeetings({}) });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setEventModal(null);
      toast('Meeting scheduled');
    },
    onError: () => toast('Failed to schedule'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateMeeting(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setEventModal(null);
      toast('Meeting updated');
    },
    onError: () => toast('Failed to update'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => cancelMeeting(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setReasonModal(null);
      toast('Meeting cancelled');
    },
    onError: () => toast('Failed to cancel'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleEventSave = (data, editingId) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancelConfirm = (reason) => {
    if (!reasonModal) return;
    cancelMutation.mutate({ id: reasonModal.meeting.id, reason });
  };

  const openNewMeeting = (date, startMin = 9 * 60, endMin = 10 * 60) => {
    setEventModal({ date: date instanceof Date ? toIso(date) : date, startMin, endMin });
  };

  const openEditMeeting = (meeting) => {
    setEventModal({
      date:     meeting.date,
      startMin: meeting.time ? timeToMin(meeting.time) : 9 * 60,
      endMin:   meeting.end_time ? timeToMin(meeting.end_time) : (meeting.time ? timeToMin(meeting.time) + 60 : 10 * 60),
      meeting,
    });
  };

  const openCancel = (meeting) => setReasonModal({ meeting, action: 'cancel' });

  const todayIso = toIso(now);

  // ── Month calendar data ───────────────────────────────────────────────────────
  const year     = calMonth.getFullYear();
  const mo       = calMonth.getMonth();
  const first    = new Date(year, mo, 1);
  const startDay = new Date(year, mo, 1 - first.getDay());
  const calDays  = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    return d;
  });

  const byDay = useMemo(() => {
    const map = {};
    meetings.forEach(m => {
      const d   = new Date(m.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] = map[key] || []).push(m);
    });
    return map;
  }, [meetings]);

  const selDayMeetings = useMemo(() => {
    const key = `${selDay.getFullYear()}-${selDay.getMonth()}-${selDay.getDate()}`;
    return byDay[key] || [];
  }, [selDay, byDay]);

  const upcoming = useMemo(() =>
    meetings
      .filter(m => m.status === 'scheduled' && new Date(m.date) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [meetings] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Week navigation label ────────────────────────────────────────────────────
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    : `${MONTHS_S[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS_S[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ── View tab pills ────────────────────────────────────────────────────────────
  const VIEWS = [
    { key: 'month',     label: 'Month' },
    { key: 'week',      label: 'Week' },
    { key: 'doletters', label: 'D.O. Letters' },
  ];

  return (
    <>
      {/* ── Header bar ── */}
      <div className="filterbar">
        <div className="period">
          <div className="l">Meeting planner</div>
          <div className="v">Schedule &amp; notify across all convergence units</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View switcher */}
          <div style={{ display: 'inline-flex', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, gap: 2 }}>
            {VIEWS.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                style={{ border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', transition: '.13s', background: view === v.key ? 'var(--accent)' : 'transparent', color: view === v.key ? '#fff' : 'var(--ink2)' }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {(isAdmin || user?.role === 'poc') && (
            <button
              type="button"
              onClick={() => openNewMeeting(todayIso)}
              style={{ border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              + New meeting
            </button>
          )}
        </div>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, gap: 0 }}>
              <button type="button" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
                style={{ border: 0, background: 'none', fontSize: 20, lineHeight: 1, padding: '1px 12px', borderRadius: 99, cursor: 'pointer', color: 'var(--ink2)', fontWeight: 600 }}>‹</button>
              <button type="button" onClick={() => setWeekStart(getMonday(new Date()))}
                style={{ border: 0, background: 'none', fontFamily: 'var(--fm)', fontSize: 12, lineHeight: 1, padding: '5px 12px', borderRadius: 99, cursor: 'pointer', color: 'var(--ink2)' }}>Today</button>
              <button type="button" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
                style={{ border: 0, background: 'none', fontSize: 20, lineHeight: 1, padding: '1px 12px', borderRadius: 99, cursor: 'pointer', color: 'var(--ink2)', fontWeight: 600 }}>›</button>
            </div>
            <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>{weekLabel}</div>
          </div>

          <WeekCalendar
            weekStart={weekStart}
            meetings={meetings}
            onSlotClick={(date, startMin, endMin) => openNewMeeting(date, startMin, endMin)}
            onDragCreate={(date, startMin, endMin) => openNewMeeting(date, startMin, endMin)}
            onEventClick={openEditMeeting}
          />
        </div>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Calendar grid */}
          <div style={{ flex: '1 1 460px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
            {/* Month nav header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>{MONTHS[mo]} {year}</div>
              <div style={{ display: 'inline-flex', gap: 3, background: '#fff', border: '1px solid var(--line)', borderRadius: 99, padding: 3 }}>
                {[['‹', -1], ['·', 0], ['›', 1]].map(([l, n]) => (
                  <button key={l} type="button"
                    onClick={() => n === 0
                      ? setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                      : setCalMonth(new Date(year, mo + n, 1))}
                    style={{ border: 0, background: 'none', fontFamily: 'var(--fm)', fontSize: n === 0 ? 14 : 22, lineHeight: 1, padding: n === 0 ? '5px 10px' : '1px 11px', borderRadius: 99, cursor: 'pointer', color: 'var(--ink2)', fontWeight: n === 0 ? 400 : 600 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {DOW.map(d => (
                  <div key={d} style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textAlign: 'center', padding: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{d}</div>
                ))}
                {calDays.map((d, i) => {
                  const key     = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                  const evs     = byDay[key] || [];
                  const iso     = toIso(d);
                  const isOther    = d.getMonth() !== mo;
                  const isToday    = d.toDateString() === now.toDateString();
                  const isSelected = d.toDateString() === selDay.toDateString();
                  return (
                    <div key={i}
                      onClick={() => { setSelDay(new Date(d)); openNewMeeting(iso); }}
                      style={{ minHeight: 72, border: `1px solid ${isSelected ? 'var(--accent)' : isToday ? 'var(--info, #4dabf7)' : 'var(--line)'}`, borderRadius: 8, padding: '7px 9px', cursor: 'pointer', background: isSelected ? 'var(--accent-light, #eef2ff)' : isToday ? '#f5f7ff' : '#fff', display: 'flex', flexDirection: 'column', gap: 3, opacity: isOther ? .35 : 1, transition: '.13s', boxShadow: isSelected ? '0 0 0 2px var(--accent)' : isToday ? '0 0 0 2px var(--info, #4dabf7)' : 'none' }}>
                      <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: isToday ? 'var(--accent)' : isSelected ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2, overflow: 'hidden' }}>
                        {evs.slice(0, 3).map((m, j) => (
                          <div key={j} onClick={e => { e.stopPropagation(); openEditMeeting(m); }} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[m.status] ?? '#ccc', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                              {m.pair.unit_a.abbr}×{m.pair.unit_b.abbr}
                            </span>
                          </div>
                        ))}
                        {evs.length > 3 && <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)' }}>+{evs.length - 3}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected day detail */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 8 }}>On {fmt(selDay)}</div>
                {selDayMeetings.length === 0
                  ? <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Nothing scheduled.</div>
                  : selDayMeetings.map(m => {
                      const A = m.pair.unit_a, B = m.pair.unit_b;
                      return (
                        <div key={m.id}
                          onClick={() => openEditMeeting(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, marginBottom: 7, background: '#fff', fontSize: 13, cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', minWidth: 52 }}>{m.time ?? ''}</span>
                          <Badge status={m.status} />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i style={{ width: 8, height: 8, borderRadius: '50%', background: A.color, display: 'inline-block' }} />{A.abbr} ×
                            <i style={{ width: 8, height: 8, borderRadius: '50%', background: B.color, display: 'inline-block' }} />{B.abbr}
                          </span>
                          {m.title && <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>}
                        </div>
                      );
                    })
                }
              </div>
            </div>
          </div>

          {/* Upcoming sidebar */}
          <div style={{ flex: '1 1 320px', border: '1px solid var(--line)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Upcoming meetings</div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)' }}>soonest first</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 600, overflowY: 'auto' }}>
              {upcoming.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center', padding: 20 }}>No upcoming meetings.</div>
                : upcoming.map(m => {
                    const d = new Date(m.date);
                    const A = m.pair.unit_a, B = m.pair.unit_b;
                    return (
                      <div key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', background: 'var(--paper)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Date badge */}
                          <div style={{ textAlign: 'center', minWidth: 48, flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{d.getDate()}</div>
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink3)' }}>{MONTHS_S[d.getMonth()]}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {m.title && <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: A.color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{A.abbr}</span>
                              <span style={{ color: 'var(--ink3)', fontSize: 12 }}>×</span>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: B.color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{B.abbr}</span>
                            </div>
                            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {m.time && <span>🕘 {m.time}</span>}
                              <span>{m.mtype === 'Online' ? '💻 Online' : '📍 In-person'}</span>
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                            <button type="button" onClick={() => openEditMeeting(m)}
                              style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 0', fontSize: 11, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', background: 'var(--paper)', color: 'var(--ink2)' }}>
                              ✎ Edit
                            </button>
                            <button type="button" onClick={() => openCancel(m)}
                              style={{ flex: 1, border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 0', fontSize: 11, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', background: '#fff5f5', color: '#ef4444' }}>
                              ✕ Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>
      )}

      {/* ── D.O. Letters view ── */}
      {view === 'doletters' && (
        <DOLettersTab user={user} />
      )}

      {/* ── Event create/edit modal ── */}
      {eventModal && (
        <EventModal
          initial={eventModal}
          pairs={pairs}
          meetings={meetings}
          onSave={handleEventSave}
          onClose={() => setEventModal(null)}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* ── Reason / cancel modal ── */}
      {reasonModal && (
        <ReasonModal
          meeting={reasonModal.meeting}
          action={reasonModal.action}
          onConfirm={handleCancelConfirm}
          onClose={() => setReasonModal(null)}
          saving={cancelMutation.isPending}
        />
      )}
    </>
  );
}
