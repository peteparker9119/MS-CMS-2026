import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CSpinner } from '@coreui/react';
import { getCustomMenus, createMenuEntry } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const INPUT_STYLE = {
  width: '100%', border: '1.5px solid var(--line)', borderRadius: 9,
  padding: '10px 14px', fontFamily: 'var(--fb)', fontSize: 14,
  background: '#fff', color: 'var(--ink)', boxSizing: 'border-box', outline: 'none',
  transition: 'border-color .15s',
};

/* ── Individual form field renderer ─────────────────────── */
function FormField({ field, value, onChange }) {
  const focus = e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-glow)'; };
  const blur  = e => { e.target.style.borderColor = 'var(--line)'; e.target.style.boxShadow = 'none'; };

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          onFocus={focus} onBlur={blur}
          style={{ ...INPUT_STYLE, minHeight: 88, resize: 'vertical' }}
        />
      );

    case 'select':
      return (
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          onFocus={focus} onBlur={blur}
          style={{ ...INPUT_STYLE, cursor: 'pointer' }}
        >
          <option value="">{field.placeholder || `Select ${field.label}…`}</option>
          {(field.options ?? []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
      );

    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, color: 'var(--ink)' }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          {field.placeholder || field.label}
        </label>
      );

    case 'file':
      return (
        <label style={{
          display: 'block', border: '2px dashed var(--line)', borderRadius: 10,
          padding: '20px', textAlign: 'center', cursor: 'pointer',
          fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--ink3)',
          transition: 'border-color .15s, background .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = ''; }}
        >
          <input type="file" style={{ display: 'none' }} onChange={e => onChange(e.target.files[0]?.name ?? '')} />
          <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
          <div style={{ fontWeight: 600, color: 'var(--ink2)', marginBottom: 2 }}>
            {value ? value : 'Click to upload'}
          </div>
          <div style={{ fontSize: 12 }}>{field.placeholder || 'Any file type accepted'}</div>
        </label>
      );

    case 'date':
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          onFocus={focus} onBlur={blur}
          style={INPUT_STYLE}
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || '0'}
          onFocus={focus} onBlur={blur}
          style={INPUT_STYLE}
        />
      );

    default:
      return (
        <input
          type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || field.label}
          onFocus={focus} onBlur={blur}
          style={INPUT_STYLE}
        />
      );
  }
}

/* ── Main page ──────────────────────────────────────────── */
export default function CustomMenuPage() {
  const { slug }      = useParams();
  const { user }      = useAuth();
  const toast         = useToast();

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['custom-menus'],
    queryFn:  getCustomMenus,
  });

  const [formData,   setFormData]   = useState({});
  const [submitted,  setSubmitted]  = useState(false);

  const menu = menus.find(m => m.slug === slug && m.is_active);

  const submitMut = useMutation({
    mutationFn: data => createMenuEntry(menu.id, data),
    onSuccess: () => {
      setSubmitted(true);
      toast('Entry submitted successfully');
    },
    onError: () => toast('Failed to submit — please try again'),
  });

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <CSpinner color="dark" />
    </div>
  );

  // Menu not found or inactive
  if (!menu) return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', fontFamily: 'var(--fm)', color: 'var(--ink3)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>Menu not found</div>
      <div>This menu doesn't exist or is currently inactive.</div>
    </div>
  );

  // Access control
  if (menu.access === 'admin' && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (menu.access === 'poc'   && !['admin','poc'].includes(user?.role)) return <Navigate to="/dashboard" replace />;

  const setField = (key, val) => setFormData(d => ({ ...d, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    for (const f of (menu.fields ?? [])) {
      if (f.required && !formData[f.field_key] && formData[f.field_key] !== false) {
        toast(`"${f.label}" is required`);
        return;
      }
    }
    submitMut.mutate(formData);
  };

  if (submitted) return (
    <div style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✅</div>
      <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>Submitted!</div>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink2)', marginBottom: 28, lineHeight: 1.6 }}>
        Your entry for <strong>{menu.name}</strong> has been recorded successfully.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={() => { setFormData({}); setSubmitted(false); }}
          style={{ padding: '10px 22px', border: 'none', borderRadius: 9, background: '#1e2333', color: '#fff', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >Submit Another</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)', marginBottom: 4 }}>
          {menu.name}
        </div>
        {menu.description && (
          <div style={{ fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6 }}>{menu.description}</div>
        )}
      </div>

      {/* Form */}
      {menu.fields?.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--line)', borderRadius: 14, fontFamily: 'var(--fm)', fontSize: 14, color: 'var(--ink3)' }}>
          This form has no fields configured yet.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '28px 32px', boxShadow: '0 1px 4px rgba(15,23,42,.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(menu.fields ?? []).map(f => (
                <div key={f.id}>
                  <label style={{
                    display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700,
                    letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 7,
                  }}>
                    {f.label}
                    {f.required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
                  </label>
                  <FormField field={f} value={formData[f.field_key]} onChange={v => setField(f.field_key, v)} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              type="submit"
              disabled={submitMut.isPending}
              style={{
                width: '100%', padding: '13px 0', border: 'none', borderRadius: 10,
                background: submitMut.isPending ? '#818cf8' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontFamily: 'var(--fb)', fontSize: 15, fontWeight: 700,
                cursor: submitMut.isPending ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitMut.isPending ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Submitting…</>
              ) : 'Submit Entry'}
            </button>
          </div>
        </form>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
