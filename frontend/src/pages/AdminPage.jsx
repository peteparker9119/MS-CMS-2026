import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, updateUser, deleteUser,
  getCustomMenus, createCustomMenu, updateCustomMenu, deleteCustomMenu,
  getMenuEntries,
} from '../api/admin';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../api/units';
import { useToast } from '../context/ToastContext';
import {
  CSpinner,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CRow, CCol,
} from '@coreui/react';
import SearchableSelect from '../components/SearchableSelect';

/* ── constants ─────────────────────────────────────────── */
const LBL = {
  display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600,
  letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6,
};
const INPUT = {
  width: '100%', border: '1.5px solid var(--line)', borderRadius: 9,
  padding: '9px 12px', fontFamily: 'var(--fb)', fontSize: 14,
  background: '#fff', color: 'var(--ink)', boxSizing: 'border-box', outline: 'none',
};
const MENUS = [
  { slug: 'dashboard',   label: 'Dashboard',    desc: 'Overview, KPIs & convergence matrix' },
  { slug: 'meetings',    label: 'Meetings',      desc: 'Calendar view & MoM entry' },
  { slug: 'planner',     label: 'Planner',       desc: 'Schedule meetings across unit pairs' },
  { slug: 'minutes',     label: 'Minutes',       desc: 'Record and view minutes' },
  { slug: 'items',       label: 'Item Tracker',  desc: 'Raise and track convergence items' },
  { slug: 'documents',   label: 'D.O. Letters',  desc: 'Upload and browse official letters' },
  { slug: 'admin-panel', label: 'Admin Panel',   desc: 'User, unit & permission management' },
];
const MENU_SLUGS = MENUS.map(m => m.slug);

const ROLE_META = {
  admin: { label: 'Admin',    bg: '#1e2333', color: '#fff'    },
  poc:   { label: 'Unit TL', bg: '#dbeafe', color: '#1d4ed8' },
  user:  { label: 'User',     bg: '#f1f5f9', color: '#475569' },
};

const FIELD_TYPES = [
  { value: 'text',     label: 'Text'        },
  { value: 'number',   label: 'Number'      },
  { value: 'date',     label: 'Date'        },
  { value: 'email',    label: 'Email'       },
  { value: 'phone',    label: 'Phone'       },
  { value: 'select',   label: 'Dropdown'    },
  { value: 'checkbox', label: 'Checkbox'    },
  { value: 'textarea', label: 'Long Text'   },
  { value: 'file',     label: 'File Upload' },
];

const ICONS = ['grid','list','document','chart','folder','star','settings','users','calendar','tag'];
const ACCESS_OPTS = [['all','All Users'],['admin','Admin Only'],['poc','TL Only']];

const TYPE_ICON = {
  text:'T', number:'#', date:'📅', email:'@', phone:'☎',
  select:'▾', checkbox:'☑', textarea:'¶', file:'📎',
};

function slugify(s) { return s.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }

/* ── Shared helpers ─────────────────────────────────────── */
function RolePill({ role }) {
  const m = ROLE_META[role] ?? ROLE_META.user;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      background: m.bg, color: m.color,
      fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
      whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function StatusPill({ active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: active ? '#dcfce7' : '#fee2e2',
      color: active ? '#166534' : '#991b1b',
      fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

function Initials({ name, role }) {
  const parts = (name ?? '').trim().split(' ');
  const init  = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?');
  const bg    = role === 'admin' ? '#1e2333' : role === 'poc' ? '#3b82f6' : '#64748b';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: bg,
      color: '#fff', fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 13,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{init.toUpperCase()}</div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LBL}>{label}</label>
      {children}
    </div>
  );
}

/* ── Options tag editor (for Dropdown fields) ──────────── */
function OptionsEditor({ options, onChange }) {
  const [draft, setDraft] = useState('');

  const addOption = () => {
    const v = draft.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setDraft('');
  };

  return (
    <div>
      {options.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {options.map((opt, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--accent-light)', color: 'var(--accent-dark)',
              borderRadius: 99, padding: '3px 10px', fontFamily: 'var(--fm)', fontSize: 12,
            }}>
              {opt}
              <button
                type="button"
                onClick={() => onChange(options.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, lineHeight: 1, padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
              >×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
          placeholder="Type an option, press Enter"
          style={{ ...INPUT, flex: 1, padding: '6px 10px', fontSize: 13 }}
        />
        <button
          type="button"
          onClick={addOption}
          style={{
            padding: '6px 14px', border: '1.5px solid var(--accent)', borderRadius: 8,
            background: 'var(--accent-light)', color: 'var(--accent-dark)',
            fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >+ Add</button>
      </div>
    </div>
  );
}

/* ── Menu Field Row (card style) ────────────────────────── */
function MenuFieldRow({ f, idx, total, onChange, onRemove, onMove }) {
  const showOptions = f.field_type === 'select';

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Row 1 — order + label + key + type + delete */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 120px 30px', gap: 6, padding: '8px 10px', alignItems: 'center' }}>
        {/* Up/Down controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <button
            type="button"
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0}
            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--line)' : 'var(--ink3)', padding: 0, fontSize: 11, lineHeight: 1, display: 'flex' }}
          >▲</button>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--ink3)', fontWeight: 700 }}>{idx + 1}</span>
          <button
            type="button"
            onClick={() => onMove(idx, 1)}
            disabled={idx === total - 1}
            style={{ background: 'none', border: 'none', cursor: idx === total - 1 ? 'default' : 'pointer', color: idx === total - 1 ? 'var(--line)' : 'var(--ink3)', padding: 0, fontSize: 11, lineHeight: 1, display: 'flex' }}
          >▼</button>
        </div>

        <input
          value={f.label}
          onChange={e => onChange(idx, 'label', e.target.value)}
          placeholder="Field label"
          style={{ ...INPUT, padding: '7px 10px' }}
        />
        <input
          value={f.field_key}
          onChange={e => onChange(idx, 'field_key', e.target.value)}
          placeholder="field_key"
          style={{ ...INPUT, padding: '7px 10px', fontFamily: 'var(--fm)', fontSize: 12 }}
        />
        <select
          value={f.field_type}
          onChange={e => onChange(idx, 'field_type', e.target.value)}
          style={{ ...INPUT, padding: '7px 10px' }}
        >
          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', color: 'var(--bad)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >×</button>
      </div>

      {/* Row 2 — placeholder + required */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 6, padding: '0 10px 8px', alignItems: 'center' }}>
        <div />
        <input
          value={f.placeholder ?? ''}
          onChange={e => onChange(idx, 'placeholder', e.target.value)}
          placeholder="Placeholder text (optional)"
          style={{ ...INPUT, padding: '6px 10px', fontSize: 12, color: 'var(--ink2)' }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink2)',
          whiteSpace: 'nowrap', paddingRight: 8,
        }}>
          <input
            type="checkbox"
            checked={f.required}
            onChange={e => onChange(idx, 'required', e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Required
        </label>
      </div>

      {/* Row 3 — options editor (select only) */}
      {showOptions && (
        <div style={{ padding: '0 10px 10px 54px', borderTop: '1px dashed var(--line)' }}>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '8px 0 6px' }}>
            Dropdown Options
          </div>
          <OptionsEditor
            options={f.options ?? []}
            onChange={opts => onChange(idx, 'options', opts)}
          />
        </div>
      )}
    </div>
  );
}

/* ── Form Preview renderer ──────────────────────────────── */
const PREVIEW_INPUT = {
  width: '100%', border: '1.5px solid var(--line)', borderRadius: 8,
  padding: '8px 12px', fontFamily: 'var(--fb)', fontSize: 13,
  background: '#f8fafc', color: 'var(--ink3)', boxSizing: 'border-box',
};

function PreviewField({ f }) {
  switch (f.field_type) {
    case 'textarea':
      return <textarea disabled placeholder={f.placeholder || f.label} style={{ ...PREVIEW_INPUT, minHeight: 76, resize: 'none' }} />;
    case 'select':
      return (
        <select disabled style={PREVIEW_INPUT}>
          <option>{f.placeholder || `Select ${f.label}…`}</option>
          {(f.options ?? []).map((opt, i) => <option key={i}>{opt}</option>)}
        </select>
      );
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'not-allowed', fontFamily: 'var(--fb)', fontSize: 13, color: 'var(--ink3)' }}>
          <input type="checkbox" disabled />
          {f.placeholder || f.label}
        </label>
      );
    case 'file':
      return (
        <div style={{ border: '2px dashed var(--line)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 13 }}>
          📎 {f.placeholder || 'Choose file…'}
        </div>
      );
    case 'date':
      return <input type="date" disabled style={PREVIEW_INPUT} />;
    default:
      return <input type={f.field_type} disabled placeholder={f.placeholder || f.label} style={PREVIEW_INPUT} />;
  }
}

/* ── User Modal (edit only) ────────────────────────────── */
function UserModal({ visible, onClose, editUser, units }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const [fFirst,    setFFirst]    = useState(editUser?.first_name ?? '');
  const [fLast,     setFLast]     = useState(editUser?.last_name ?? '');
  const [fEmail,    setFEmail]    = useState(editUser?.email ?? '');
  const [fRole,     setFRole]     = useState(editUser?.role ?? 'poc');
  const [fUnit,     setFUnit]     = useState(editUser?.unit ?? '');
  const [fActive,   setFActive]   = useState(editUser?.is_active ?? true);
  const [fWA,       setFWA]       = useState(editUser?.whatsapp_number ?? '');
  const [fMenus,    setFMenus]    = useState(
    editUser?.menu_permissions?.length > 0 ? editUser.menu_permissions : [...MENU_SLUGS]
  );

  const toggleMenu = slug => setFMenus(m => m.includes(slug) ? m.filter(s => s !== slug) : [...m, slug]);
  const allOn      = fMenus.length === MENU_SLUGS.length;

  const saveMut = useMutation({
    mutationFn: data => updateUser(editUser.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast('User updated');
      onClose();
    },
    onError: () => toast('Failed to save user'),
  });

  const handleSave = () => {
    if (!fFirst.trim() || !fLast.trim()) { toast('Enter first and last name'); return; }
    const data = {
      first_name: fFirst, last_name: fLast, email: fEmail,
      role: fRole, is_active: fActive,
      whatsapp_number: fWA || null,
      menu_permissions: allOn ? [] : fMenus,
    };
    if (fRole !== 'admin') data.unit = fUnit || null;
    saveMut.mutate(data);
  };

  return (
    <CModal visible={visible} onClose={onClose} size="lg" alignment="center">
      <CModalHeader style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>
          Edit — {editUser.username}
        </CModalTitle>
      </CModalHeader>
      <CModalBody style={{ padding: '22px 24px' }}>
        <CRow className="g-3">
          <CCol xs={6}>
            <Field label="First Name">
              <input style={INPUT} value={fFirst} onChange={e => setFFirst(e.target.value)} placeholder="First name" />
            </Field>
          </CCol>
          <CCol xs={6}>
            <Field label="Last Name">
              <input style={INPUT} value={fLast} onChange={e => setFLast(e.target.value)} placeholder="Last name" />
            </Field>
          </CCol>
        </CRow>

        <Field label="Email (optional)">
          <input style={INPUT} type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="user@example.com" />
        </Field>

        <Field label="WhatsApp Number">
          <input style={INPUT} value={fWA} onChange={e => setFWA(e.target.value)} placeholder="e.g. 919876543210 (no + prefix)" />
          <div style={{ fontSize:11, color:'var(--ink3)', marginTop:3 }}>Country code + number, no + sign</div>
        </Field>

        <CRow className="g-3">
          <CCol xs={fRole !== 'admin' ? 6 : 12}>
            <Field label="Role">
              <select style={INPUT} value={fRole} onChange={e => setFRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="poc">Unit TL</option>
              </select>
            </Field>
          </CCol>
          {fRole !== 'admin' && (
            <CCol xs={6}>
              <Field label="Convergence Unit">
                <SearchableSelect
                  value={fUnit}
                  onChange={v => setFUnit(v)}
                  placeholder="— None —"
                  options={units.map(u => ({ value: String(u.id), label: u.name }))}
                />
              </Field>
            </CCol>
          )}
        </CRow>

        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Account Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(v => (
              <button key={String(v)} type="button" onClick={() => setFActive(v)}
                style={{
                  flex: 1, border: `1.5px solid ${fActive === v ? (v ? '#16a34a' : '#dc2626') : 'var(--line)'}`,
                  borderRadius: 9, padding: '8px 0', fontFamily: 'var(--fb)', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', transition: '.13s',
                  background: fActive === v ? (v ? '#dcfce7' : '#fee2e2') : '#fff',
                  color: fActive === v ? (v ? '#166534' : '#991b1b') : 'var(--ink3)',
                }}
              >{v ? '✓ Active' : '✗ Disabled'}</button>
            ))}
          </div>
        </div>

        {/* Menu / Feature Access */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={LBL}>Menu & Feature Access</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)' }}>
              <input type="checkbox" checked={allOn} onChange={() => setFMenus(allOn ? [] : [...MENU_SLUGS])} style={{ accentColor: 'var(--accent)' }} />
              Select all
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {MENUS.map(m => {
              const on = fMenus.includes(m.slug);
              return (
                <label key={m.slug} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '9px 12px', borderRadius: 9,
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                  background: on ? 'var(--accent-light)' : '#fff', transition: '.13s',
                }}>
                  <input type="checkbox" checked={on} onChange={() => toggleMenu(m.slug)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, color: on ? 'var(--accent-dark)' : 'var(--ink)' }}>{m.label}</div>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>{m.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </CModalBody>
      <CModalFooter style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 8 }}>
        <button onClick={onClose}
          style={{ padding: '8px 18px', border: '1.5px solid var(--line)', borderRadius: 9, background: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink2)' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saveMut.isPending}
          style={{ padding: '8px 22px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saveMut.isPending ? .6 : 1 }}>
          {saveMut.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </CModalFooter>
    </CModal>
  );
}

/* ── Unit Modal ────────────────────────────────────────── */
function UnitModal({ visible, onClose, editUnit }) {
  const toast  = useToast();
  const qc     = useQueryClient();
  const isEdit = !!editUnit;

  const [fName,       setFName]       = useState(editUnit?.name ?? '');
  const [fAbbr,       setFAbbr]       = useState(editUnit?.abbr ?? '');
  const [fSlug,       setFSlug]       = useState(editUnit?.slug ?? '');
  const [fColor,      setFColor]      = useState(editUnit?.color ?? '#378ADD');
  const [fMemberName, setFMemberName] = useState(editUnit?.member_name ?? '');

  const saveMut = useMutation({
    mutationFn: data => isEdit ? updateUnit(editUnit.id, data) : createUnit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-units'] });
      qc.invalidateQueries({ queryKey: ['units'] });
      toast(isEdit ? 'Unit updated' : 'Unit created');
      onClose();
    },
    onError: () => toast('Failed to save unit'),
  });

  const handleSave = () => {
    if (!fName.trim() || !fAbbr.trim() || !fSlug.trim()) { toast('Name, abbreviation and slug are required'); return; }
    saveMut.mutate({ name: fName, abbr: fAbbr, slug: fSlug, color: fColor, member_name: fMemberName });
  };

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>
          {isEdit ? `Edit Unit — ${editUnit.abbr}` : 'Create Convergence Unit'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody style={{ padding: '22px 24px' }}>
        <Field label="Full Name">
          <input style={INPUT} value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. School Management Committee" />
        </Field>
        <CRow className="g-3">
          <CCol xs={4}>
            <Field label="Abbreviation">
              <input style={INPUT} value={fAbbr} onChange={e => setFAbbr(e.target.value)} placeholder="SMC" />
            </Field>
          </CCol>
          <CCol xs={4}>
            <Field label="Slug">
              <input style={INPUT} value={fSlug} onChange={e => setFSlug(e.target.value)} placeholder="smc" />
            </Field>
          </CCol>
          <CCol xs={4}>
            <Field label="Colour">
              <input type="color" style={{ ...INPUT, height: 40, padding: '3px 6px', cursor: 'pointer' }} value={fColor} onChange={e => setFColor(e.target.value)} />
            </Field>
          </CCol>
        </CRow>
        <Field label="Member Name">
          <input style={INPUT} value={fMemberName} onChange={e => setFMemberName(e.target.value)} placeholder="Name of the point-of-contact member" />
        </Field>
      </CModalBody>
      <CModalFooter style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 8 }}>
        <button onClick={onClose}
          style={{ padding: '8px 18px', border: '1.5px solid var(--line)', borderRadius: 9, background: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink2)' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saveMut.isPending}
          style={{ padding: '8px 22px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saveMut.isPending ? .6 : 1 }}>
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Unit'}
        </button>
      </CModalFooter>
    </CModal>
  );
}

/* ── Users Tab ─────────────────────────────────────────── */
function UsersTab({ units }) {
  const toast = useToast();
  const qc    = useQueryClient();

  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: getUsers });

  const [editTarget, setEditTarget] = useState(null);
  const [search,     setSearch]     = useState('');

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }) => updateUser(id, { is_active: active }),
    onSuccess: (_, { active }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast(active ? 'User enabled' : 'User disabled');
    },
    onError: () => toast('Failed to update status'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast('User deleted'); },
    onError:   () => toast('Failed to delete user'),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.unit_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const totalActive = users.filter(u => u.is_active).length;
  const totalAdmin  = users.filter(u => u.role === 'admin').length;
  const totalPoc    = users.filter(u => u.role === 'poc').length;

  const statCards = [
    { label: 'Total Users', value: users.length, color: '#4f46e5' },
    { label: 'Active',      value: totalActive,  color: '#16a34a' },
    { label: 'Admin',       value: totalAdmin,   color: '#0f172a' },
    { label: 'Unit TL',     value: totalPoc,     color: '#2563eb' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 17, color: '#fff' }}>{s.value}</span>
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, username, unit…"
          style={{ ...INPUT, width: 280 }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 1fr 1fr auto', gap: 0, padding: '9px 18px', background: 'var(--paper)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>User</span><span>Role</span><span>Unit</span><span>Status</span><span>Menus</span><span>Actions</span>
        </div>

        {isLoading && <div style={{ padding: 40, textAlign: 'center' }}><CSpinner color="dark" /></div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>No users found.</div>
        )}

        {filtered.map((u, i) => {
          const name      = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username;
          const menuCount = !u.menu_permissions || u.menu_permissions.length === 0
            ? 'Full'
            : `${u.menu_permissions.length}/${MENU_SLUGS.length}`;
          return (
            <div key={u.id} style={{
              display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.5fr 1fr 1fr auto',
              gap: 0, padding: '13px 18px', alignItems: 'center',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none',
              transition: '.12s', background: u.is_active ? '#fff' : '#fafafa',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
              onMouseLeave={e => e.currentTarget.style.background = u.is_active ? '#fff' : '#fafafa'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Initials name={name} role={u.role} />
                <div>
                  <div style={{ fontFamily: 'var(--fb)', fontWeight: 600, fontSize: 14, color: u.is_active ? 'var(--ink)' : 'var(--ink3)' }}>{name}</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>@{u.username}{u.email ? ` · ${u.email}` : ''}</div>
                </div>
              </div>
              <div><RolePill role={u.role} /></div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)' }}>
                {u.unit_color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.unit_color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                {u.unit_name ?? <span style={{ color: 'var(--ink3)' }}>—</span>}
              </div>
              <div>
                <button onClick={() => toggleActiveMut.mutate({ id: u.id, active: !u.is_active })}
                  title={u.is_active ? 'Click to disable' : 'Click to enable'}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <StatusPill active={u.is_active} />
                </button>
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: menuCount === 'Full' ? 'var(--ok)' : 'var(--ink2)', fontWeight: menuCount === 'Full' ? 700 : 400 }}>
                {menuCount === 'Full' ? '✓ Full access' : `${menuCount} menus`}
              </div>
              <div style={{ display: 'flex', gap: 6, paddingLeft: 8 }}>
                <button onClick={() => setEditTarget(u)}
                  style={{ padding: '5px 12px', border: '1.5px solid var(--line)', borderRadius: 7, background: '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--accent-dark)' }}>Edit</button>
                <button onClick={() => { if (window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) deleteMut.mutate(u.id); }}
                  style={{ padding: '5px 12px', border: '1.5px solid #fca5a5', borderRadius: 7, background: '#fff5f5', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--bad)' }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {editTarget && (
        <UserModal visible onClose={() => setEditTarget(null)} editUser={editTarget} units={units} />
      )}
    </>
  );
}

/* ── Units Tab ─────────────────────────────────────────── */
function UnitsTab() {
  const toast = useToast();
  const qc    = useQueryClient();

  const { data: units = [], isLoading } = useQuery({ queryKey: ['admin-units'], queryFn: getUnits });
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const deleteMut = useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-units'] }); qc.invalidateQueries({ queryKey: ['units'] }); toast('Unit deleted'); },
    onError:   () => toast('Failed to delete unit'),
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
          style={{ padding: '8px 18px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Create Unit
        </button>
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><CSpinner color="dark" /></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {units.map(u => (
          <div key={u.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: u.color ?? '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15, color: '#fff' }}>{u.abbr}</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--fb)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{u.name}</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>slug: {u.slug}</div>
              </div>
            </div>
            {u.member_name && (
              <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink2)', marginBottom: 12 }}>
                {u.member_name}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => { setEditTarget(u); setModalOpen(true); }}
                style={{ flex: 1, padding: '6px 0', border: '1.5px solid var(--line)', borderRadius: 8, background: '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--accent-dark)' }}>Edit</button>
              <button onClick={() => { if (window.confirm(`Delete unit "${u.name}"?`)) deleteMut.mutate(u.id); }}
                style={{ flex: 1, padding: '6px 0', border: '1.5px solid #fca5a5', borderRadius: 8, background: '#fff5f5', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--bad)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <UnitModal visible={modalOpen} onClose={() => setModalOpen(false)} editUnit={editTarget} />}
    </>
  );
}

/* ── Menu Modal ─────────────────────────────────────────── */
function MenuModal({ visible, onClose, editMenu }) {
  const toast  = useToast();
  const qc     = useQueryClient();
  const isEdit = !!editMenu;

  const [name,       setName]       = useState(editMenu?.name ?? '');
  const [slug,       setSlug]       = useState(editMenu?.slug ?? '');
  const [icon,       setIcon]       = useState(editMenu?.icon ?? 'list');
  const [desc,       setDesc]       = useState(editMenu?.description ?? '');
  const [access,     setAccess]     = useState(editMenu?.access ?? 'all');
  const [active,     setActive]     = useState(editMenu?.is_active ?? true);
  const [fields,     setFields]     = useState(
    editMenu?.fields?.length ? editMenu.fields.map(f => ({ ...f })) : []
  );
  const [builderTab, setBuilderTab] = useState('build'); // 'build' | 'preview'

  const autoSlug = (n) => { setName(n); if (!isEdit) setSlug(slugify(n)); };

  const addField = () => setFields(f => [
    ...f,
    { label: '', field_key: '', field_type: 'text', placeholder: '', required: false, options: [], order: f.length },
  ]);

  const updateField = (idx, key, val) => setFields(f => {
    const next = [...f];
    next[idx] = { ...next[idx], [key]: val };
    if (key === 'label' && !isEdit) next[idx].field_key = slugify(val);
    return next;
  });

  const removeField = (idx) => setFields(f => f.filter((_, i) => i !== idx));

  const moveField = (idx, dir) => setFields(f => {
    const next  = [...f];
    const swap  = idx + dir;
    if (swap < 0 || swap >= next.length) return next;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
  });

  const saveMut = useMutation({
    mutationFn: data => isEdit ? updateCustomMenu(editMenu.id, data) : createCustomMenu(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-menus'] });
      toast(isEdit ? 'Menu updated' : 'Menu created');
      onClose();
    },
    onError: () => toast('Failed to save menu'),
  });

  const handleSave = () => {
    if (!name.trim()) { toast('Enter a menu name'); return; }
    if (!slug.trim()) { toast('Enter a slug'); return; }
    const fieldsData = fields.map((f, i) => ({ ...f, order: i }));
    saveMut.mutate({ name, slug, icon, description: desc, access, is_active: active, fields_data: fieldsData });
  };

  return (
    <CModal visible={visible} onClose={onClose} size="xl" alignment="center">
      <CModalHeader style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>
          {isEdit ? `Edit Menu — ${editMenu.name}` : 'Create Custom Menu'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody style={{ padding: '22px 24px' }}>
        <CRow className="g-3">
          {/* ── Left col: basic settings ── */}
          <CCol md={5}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Menu Name">
                <input style={INPUT} value={name} onChange={e => autoSlug(e.target.value)} placeholder="e.g. School Reports" />
              </Field>
              <Field label="URL Slug">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>/</span>
                  <input style={{ ...INPUT, paddingLeft: 22 }} value={slug} onChange={e => setSlug(e.target.value)} placeholder="school-reports" />
                </div>
              </Field>
              <Field label="Description">
                <textarea style={{ ...INPUT, resize: 'none', minHeight: 60 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this menu is for…" />
              </Field>
              <Field label="Icon">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ICONS.map(ic => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${icon === ic ? 'var(--accent)' : 'var(--line)'}`, background: icon === ic ? 'var(--accent-light)' : '#fff', cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 11, color: icon === ic ? 'var(--accent-dark)' : 'var(--ink3)', transition: '.12s' }}>
                      {ic.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Access Control">
                <div style={{ display: 'flex', gap: 6 }}>
                  {ACCESS_OPTS.map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setAccess(v)}
                      style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${access === v ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 9, background: access === v ? 'var(--accent-light)' : '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: access === v ? 'var(--accent-dark)' : 'var(--ink3)', transition: '.12s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Status">
                <div style={{ display: 'flex', gap: 6 }}>
                  {[[true, 'Active'], [false, 'Inactive']].map(([v, l]) => (
                    <button key={String(v)} type="button" onClick={() => setActive(v)}
                      style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${active === v ? (v ? '#16a34a' : '#dc2626') : 'var(--line)'}`, borderRadius: 9, background: active === v ? (v ? '#dcfce7' : '#fee2e2') : '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active === v ? (v ? '#166534' : '#991b1b') : 'var(--ink3)', transition: '.12s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </CCol>

          {/* ── Right col: field builder / preview ── */}
          <CCol md={7}>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 22, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Tab header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', background: 'var(--paper)', borderRadius: 9, padding: 3, gap: 2 }}>
                  {[['build', 'Field Builder'], ['preview', '👁 Preview']].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setBuilderTab(key)}
                      style={{ padding: '5px 14px', border: 'none', borderRadius: 7, fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '.13s', background: builderTab === key ? '#fff' : 'transparent', color: builderTab === key ? 'var(--accent-dark)' : 'var(--ink3)', boxShadow: builderTab === key ? '0 1px 3px rgba(15,23,42,.08)' : 'none' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {builderTab === 'build' && (
                  <button type="button" onClick={addField}
                    style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + Add Field
                  </button>
                )}
              </div>

              {/* Build tab */}
              {builderTab === 'build' && (
                <>
                  {fields.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 120px 30px', gap: 6, padding: '2px 10px', marginBottom: 4 }}>
                      {['↕', 'Label', 'Key', 'Type', ''].map((h, i) => (
                        <div key={i} style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i === 0 || i === 4 ? 'center' : 'left' }}>{h}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', flex: 1 }}>
                    {fields.length === 0
                      ? <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)', border: '2px dashed var(--line)', borderRadius: 12 }}>No fields yet — click "Add Field" to start building</div>
                      : fields.map((f, i) => (
                          <MenuFieldRow key={i} f={f} idx={i} total={fields.length} onChange={updateField} onRemove={removeField} onMove={moveField} />
                        ))
                    }
                  </div>
                </>
              )}

              {/* Preview tab */}
              {builderTab === 'preview' && (
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 440 }}>
                  <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '20px 24px' }}>
                    {/* Form header */}
                    <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>
                        {name || <span style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Untitled Form</span>}
                      </div>
                      {desc && <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)' }}>{desc}</div>}
                    </div>

                    {fields.length === 0
                      ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink3)', border: '2px dashed var(--line)', borderRadius: 8, fontFamily: 'var(--fm)', fontSize: 13 }}>Add fields to see preview</div>
                      : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {fields.map((f, i) => (
                            <div key={i}>
                              <label style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)', marginBottom: 6 }}>
                                {f.label || <span style={{ fontStyle: 'italic' }}>Untitled field</span>}
                                {f.required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
                              </label>
                              <PreviewField f={f} />
                            </div>
                          ))}
                          <button type="button" disabled style={{ padding: '10px 0', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 700, opacity: .5, cursor: 'not-allowed' }}>
                            Submit Entry
                          </button>
                        </div>
                      )
                    }
                  </div>
                </div>
              )}
            </div>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 8 }}>
        <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid var(--line)', borderRadius: 9, background: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink2)' }}>Cancel</button>
        <button onClick={handleSave} disabled={saveMut.isPending}
          style={{ padding: '8px 22px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saveMut.isPending ? .6 : 1 }}>
          {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Menu'}
        </button>
      </CModalFooter>
    </CModal>
  );
}

/* ── Entries Modal ──────────────────────────────────────── */
function EntriesModal({ menu, onClose }) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['menu-entries', menu.id],
    queryFn:  () => getMenuEntries(menu.id),
  });

  const exportCsv = () => {
    if (!entries.length) return;
    const cols    = menu.fields ?? [];
    const headers = ['Date', 'Submitted By', ...cols.map(f => f.label)];
    const rows    = entries.map(e => [
      new Date(e.submitted_at).toLocaleString(),
      e.submitted_by_name,
      ...cols.map(f => {
        const v = e.data?.[f.field_key] ?? '';
        return Array.isArray(v) ? v.join(', ') : String(v);
      }),
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${menu.slug}-entries.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const cols = menu.fields ?? [];

  return (
    <CModal visible onClose={onClose} size="xl" alignment="center">
      <CModalHeader style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
        <div>
          <CModalTitle style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>
            Entries — {menu.name}
          </CModalTitle>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>
            {entries.length} submission{entries.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CModalHeader>
      <CModalBody style={{ padding: '18px 24px' }}>
        {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><CSpinner color="dark" /></div>}
        {!isLoading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
            No entries have been submitted yet.
          </div>
        )}
        {!isLoading && entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--fm)', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--paper)', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>Submitted By</th>
                  {cols.map(f => (
                    <th key={f.id} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--line)' : 'none' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--paper)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>
                      {new Date(e.submitted_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {e.submitted_by_name}
                    </td>
                    {cols.map(f => {
                      const v = e.data?.[f.field_key];
                      const display = v == null ? '—' : Array.isArray(v) ? v.join(', ') : String(v);
                      return <td key={f.id} style={{ padding: '10px 14px', color: 'var(--ink2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display || '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CModalBody>
      <CModalFooter style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 8 }}>
        {entries.length > 0 && (
          <button onClick={exportCsv}
            style={{ padding: '8px 18px', border: '1.5px solid var(--accent)', borderRadius: 9, background: 'var(--accent-light)', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--accent-dark)' }}>
            ↓ Export CSV
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose}
          style={{ padding: '8px 18px', border: '1.5px solid var(--line)', borderRadius: 9, background: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink2)' }}>
          Close
        </button>
      </CModalFooter>
    </CModal>
  );
}

/* ── Menu Builder Tab ──────────────────────────────────── */
function MenuBuilderTab() {
  const toast = useToast();
  const qc    = useQueryClient();

  const { data: menus = [], isLoading } = useQuery({ queryKey: ['custom-menus'], queryFn: getCustomMenus });
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [entriesMenu,    setEntriesMenu]    = useState(null);

  const deleteMut = useMutation({
    mutationFn: deleteCustomMenu,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-menus'] }); toast('Menu deleted'); },
    onError:   () => toast('Failed to delete'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => updateCustomMenu(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-menus'] }); },
  });

  const totalActive   = menus.filter(m => m.is_active).length;
  const totalEntries  = menus.reduce((s, m) => s + (m.entry_count ?? 0), 0);
  const totalFields   = menus.reduce((s, m) => s + (m.fields?.length ?? 0), 0);

  return (
    <>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Custom Menus', value: menus.length,   color: '#4f46e5' },
          { label: 'Active',       value: totalActive,    color: '#16a34a' },
          { label: 'Total Entries',value: totalEntries,   color: '#0891b2' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 17, color: '#fff' }}>{s.value}</span>
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)' }}>
          {totalFields > 0 ? `${totalFields} total fields across ${menus.length} menu${menus.length !== 1 ? 's' : ''}` : `${menus.length} custom menu${menus.length !== 1 ? 's' : ''} configured`}
        </div>
        <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
          style={{ padding: '8px 18px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Create Menu
        </button>
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><CSpinner color="dark" /></div>}

      {!isLoading && menus.length === 0 && (
        <div style={{ padding: '60px 0', textAlign: 'center', border: '2px dashed var(--line)', borderRadius: 16, color: 'var(--ink3)', fontFamily: 'var(--fm)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🧩</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No custom menus yet</div>
          <div style={{ fontSize: 13 }}>Create a menu to define new data-collection modules for your workspace.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {menus.map(m => (
          <div key={m.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 16, alignItems: 'flex-start' }}>
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: m.is_active ? 'var(--accent-light)' : 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: m.is_active ? 'var(--accent-dark)' : 'var(--ink3)', textTransform: 'uppercase' }}>{m.icon?.slice(0, 3)}</span>
              </div>

              {/* Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--fb)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{m.name}</span>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 99, padding: '2px 8px' }}>/{m.slug}</span>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 99, padding: '2px 8px' }}>
                    {ACCESS_OPTS.find(a => a[0] === m.access)?.[1] ?? m.access}
                  </span>
                  {(m.entry_count ?? 0) > 0 && (
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: '#0891b2', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 99, padding: '2px 8px', fontWeight: 700 }}>
                      {m.entry_count} entr{m.entry_count === 1 ? 'y' : 'ies'}
                    </span>
                  )}
                </div>
                {m.description && <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink2)', marginBottom: 6 }}>{m.description}</div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {m.fields?.map(f => (
                    <span key={f.id} style={{ fontFamily: 'var(--fm)', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#f1f5f9', color: 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{TYPE_ICON[f.field_type]}</span>{f.label}{f.required && <span style={{ color: 'var(--bad)' }}>*</span>}
                    </span>
                  ))}
                  {!m.fields?.length && <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--ink3)' }}>No fields defined</span>}
                </div>
              </div>

              {/* Status toggle */}
              <button onClick={() => toggleMut.mutate({ id: m.id, is_active: !m.is_active })}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                <StatusPill active={m.is_active} />
              </button>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => setEntriesMenu(m)}
                  style={{ padding: '5px 12px', border: '1.5px solid #bae6fd', borderRadius: 7, background: '#e0f2fe', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#0369a1' }}>
                  Entries {(m.entry_count ?? 0) > 0 ? `(${m.entry_count})` : ''}
                </button>
                <button onClick={() => { setEditTarget(m); setModalOpen(true); }}
                  style={{ padding: '5px 12px', border: '1.5px solid var(--line)', borderRadius: 7, background: '#fff', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--accent-dark)' }}>Edit</button>
                <button onClick={() => { if (window.confirm(`Delete menu "${m.name}"?`)) deleteMut.mutate(m.id); }}
                  style={{ padding: '5px 12px', border: '1.5px solid #fca5a5', borderRadius: 7, background: '#fff5f5', fontFamily: 'var(--fb)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--bad)' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <MenuModal visible={modalOpen} onClose={() => setModalOpen(false)} editMenu={editTarget} />
      )}
      {entriesMenu && (
        <EntriesModal menu={entriesMenu} onClose={() => setEntriesMenu(null)} />
      )}
    </>
  );
}

/* ── Main ──────────────────────────────────────────────── */
const TABS = [
  { key: 'users',   label: 'Users & Logins'    },
  { key: 'units',   label: 'Convergence Units'  },
  { key: 'menus',   label: 'Menu Builder'       },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const { data: units = [] } = useQuery({ queryKey: ['admin-units'], queryFn: getUnits });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>Admin Panel</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)', marginTop: 3 }}>
            Manage user accounts, roles, menu access and convergence units
          </div>
        </div>
        <div className="seg">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'users' && <UsersTab units={units} />}
      {tab === 'units' && <UnitsTab />}
      {tab === 'menus' && <MenuBuilderTab />}
    </>
  );
}
