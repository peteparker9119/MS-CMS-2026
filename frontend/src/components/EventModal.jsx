import { useState, useMemo, useEffect } from 'react';
import WysiwygEditor from './WysiwygEditor';
import DateField from './DateField';
import TimeField from './TimeField';

const LBL = {
  fontFamily: 'var(--fm)',
  fontSize: 11,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
  marginBottom: 4,
  display: 'block',
};

const INPUT_STYLE = {
  width: '100%',
  border: '1px solid var(--line)',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: 'var(--fm)',
  color: 'var(--ink)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const SELECT_STYLE = {
  ...INPUT_STYLE,
  cursor: 'pointer',
};

const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'Does not repeat' },
  { value: 'daily',   label: 'Every day' },
  { value: 'weekly',  label: 'Every week' },
  { value: 'monthly', label: 'Every month on the day' },
  { value: 'custom',  label: 'Custom...' },
];

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min) {
  const clamped = Math.max(0, Math.min(min, 23 * 60 + 59));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function randPart(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateMeetLink() {
  return `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
}

export default function EventModal({ initial, pairs, meetings, onSave, onClose, saving = false }) {
  const editing = initial?.meeting ?? null;

  const initDate     = initial?.date     ? (initial.date instanceof Date ? `${initial.date.getFullYear()}-${String(initial.date.getMonth()+1).padStart(2,'0')}-${String(initial.date.getDate()).padStart(2,'0')}` : initial.date) : '';
  const initStartMin = initial?.startMin ?? (editing?.time ? timeToMin(editing.time) : 9 * 60);
  const initEndMin   = initial?.endMin   ?? (editing?.end_time ? timeToMin(editing.end_time) : initStartMin + 60);

  const [title,      setTitle]      = useState(editing?.title || '');
  const [date,       setDate]       = useState(editing?.date  || initDate);
  const [startTime,  setStartTime]  = useState(editing?.time      || minToTime(initStartMin));
  const [endTime,    setEndTime]    = useState(editing?.end_time  || minToTime(initEndMin));
  const [recurrence, setRecurrence] = useState(editing?.recurrence || 'none');
  const [mtype,      setMtype]      = useState(editing?.mtype || 'In-person');
  const [meetLink,   setMeetLink]   = useState(editing?.meet_link || '');
  const [pairId,     setPairId]     = useState(editing?.pair?.id ? String(editing.pair.id) : '');
  const [notify,     setNotify]     = useState(() => editing?.notify_units?.map(u => u.id) || []);
  const [description,setDescription]= useState(editing?.description || '');

  // When pair changes, default notify both units
  const selectedPair = useMemo(() => pairs.find(p => p.id === parseInt(pairId)), [pairs, pairId]);
  const pairUnits    = useMemo(() => selectedPair ? [selectedPair.unit_a, selectedPair.unit_b] : [], [selectedPair]);

  useEffect(() => {
    if (selectedPair && notify.length === 0 && !editing) {
      setNotify([selectedPair.unit_a.id, selectedPair.unit_b.id]);
    }
  }, [selectedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conflict detection
  const startMin = timeToMin(startTime);
  const endMin   = timeToMin(endTime) || startMin + 60;

  const hasConflict = useMemo(() => {
    if (!pairId || !date || !startTime) return false;
    const sameDayMeetings = meetings.filter(m => m.date === date && m.id !== editing?.id && m.status !== 'cancelled');
    return sameDayMeetings.some(m => {
      const mStart = timeToMin(m.time);
      const mEnd   = m.end_time ? timeToMin(m.end_time) : mStart + 60;
      return startMin < mEnd && endMin > mStart;
    });
  }, [meetings, pairId, date, startMin, endMin, editing]);

  const handleSave = () => {
    if (!pairId) return;
    if (!date)   return;
    const data = {
      pair_id:          parseInt(pairId),
      date,
      time:             startTime || null,
      end_time:         endTime   || null,
      title:            title.trim(),
      description,
      meet_link:        meetLink.trim(),
      recurrence,
      mtype,
      notify_unit_ids:  notify.map(Number),
    };
    onSave(data, editing?.id);
  };

  const toggleNotify = (uid) => {
    setNotify(n => n.includes(uid) ? n.filter(x => x !== uid) : [...n, uid]);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1040, backdropFilter: 'blur(2px)' }}
      />

      {/* Modal card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 1050,
        width: 'min(720px, 96vw)',
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,.22)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
            {editing ? 'Edit meeting' : 'New meeting'}
          </div>
          <button onClick={onClose} type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink3)', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Modal body — two columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{ flex: '0 0 58%', padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Title */}
            <div>
              <label style={LBL}>Meeting title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Meeting title"
                style={{ ...INPUT_STYLE, fontSize: 15, fontWeight: 600, fontFamily: 'var(--fd)' }}
              />
            </div>

            {/* Date + Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', gap: 8 }}>
              <div>
                <label style={LBL}>Date</label>
                <DateField value={date} onChange={v => setDate(v)} />
              </div>
              <div>
                <label style={LBL}>Start</label>
                <TimeField value={startTime} onChange={v => setStartTime(v)} />
              </div>
              <div>
                <label style={LBL}>End</label>
                <TimeField value={endTime} onChange={v => setEndTime(v)} />
              </div>
            </div>

            {/* Recurrence */}
            <div>
              <label style={LBL}>Repeat</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={SELECT_STYLE}>
                {RECURRENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Meeting type toggle */}
            <div>
              <label style={LBL}>Meeting type</label>
              <div style={{ display: 'inline-flex', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, gap: 3 }}>
                {[['In-person', '📍 In-person'], ['Online', '💻 Online']].map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setMtype(val); if (val === 'In-person') setMeetLink(''); }}
                    style={{ border: 'none', borderRadius: 6, padding: '5px 16px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', transition: '.13s', background: mtype === val ? 'var(--accent)' : 'transparent', color: mtype === val ? '#fff' : 'var(--ink2)' }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Meet */}
            {mtype === 'Online' && (
              <div>
                <label style={LBL}>Google Meet</label>
                {meetLink ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <a href={meetLink} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all', flex: 1 }}>
                      {meetLink}
                    </a>
                    <button type="button" onClick={() => setMeetLink('')} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontFamily: 'var(--fm)', cursor: 'pointer', background: 'var(--paper)', color: 'var(--ink2)', flexShrink: 0 }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMeetLink(generateMeetLink())}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--accent)', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontFamily: 'var(--fm)', cursor: 'pointer', background: 'var(--accent-light, #eef2ff)', color: 'var(--accent)', fontWeight: 600 }}
                  >
                    <span style={{ fontSize: 16 }}>📹</span> Add Google Meet
                  </button>
                )}
              </div>
            )}

            {/* Conflict warning */}
            {hasConflict && (
              <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '9px 13px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  <strong>Conflict:</strong> another meeting overlaps this time slot. You can still save.
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--line)', flexShrink: 0 }} />

          {/* Right panel */}
          <div style={{ flex: 1, padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--paper)' }}>
            {/* Pair selector */}
            <div>
              <label style={LBL}>Convergence unit pair</label>
              <select
                value={pairId}
                onChange={e => { setPairId(e.target.value); setNotify([]); }}
                style={SELECT_STYLE}
              >
                <option value="">— Select a pair —</option>
                {pairs.map(p => (
                  <option key={p.id} value={p.id}>{p.unit_a.name} × {p.unit_b.name}</option>
                ))}
              </select>
            </div>

            {/* Notify units */}
            {pairUnits.length > 0 && (
              <div>
                <label style={LBL}>Notify units</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pairUnits.map(u => (
                    <label
                      key={u.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 10px', border: `1px solid ${notify.includes(u.id) ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 8, background: notify.includes(u.id) ? 'var(--accent-light, #eef2ff)' : '#fff', transition: '.13s' }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0 }}
                        checked={notify.includes(u.id)}
                        onChange={() => toggleNotify(u.id)}
                      />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: u.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{u.abbr}</span>
                      <span style={{ color: 'var(--ink3)', fontSize: 11, marginLeft: 'auto' }}>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label style={LBL}>Description</label>
              <WysiwygEditor value={description} onChange={setDescription} placeholder="Add agenda or description…" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid var(--line)', flexShrink: 0, background: '#fff' }}>
          <div>
            {hasConflict && (
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ Time conflict detected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: '7px 18px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 600, cursor: 'pointer', background: 'var(--paper)', color: 'var(--ink2)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!pairId || !date || saving}
              style={{ border: 'none', borderRadius: 7, padding: '7px 20px', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 700, cursor: !pairId || !date || saving ? 'not-allowed' : 'pointer', background: !pairId || !date ? '#c7cce0' : 'var(--accent)', color: '#fff', opacity: saving ? .7 : 1, transition: '.13s' }}
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule meeting'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
