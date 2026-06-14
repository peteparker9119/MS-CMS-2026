import { useRef, useEffect, useState } from 'react';

const TOOLS = [
  { cmd: 'bold',                label: 'B',       style: { fontWeight: 700 } },
  { cmd: 'italic',              label: 'I',       style: { fontStyle: 'italic' } },
  { cmd: 'underline',           label: 'U',       style: { textDecoration: 'underline' } },
  { cmd: 'insertUnorderedList', label: '• List',  style: {} },
  { cmd: 'insertOrderedList',   label: '1. List', style: {} },
];

export default function WysiwygEditor({ value, onChange, placeholder = 'Add description…' }) {
  const ref = useRef(null);
  const [empty, setEmpty] = useState(!value);

  // Set initial HTML once on mount — never overwrite via React after that
  // (re-setting innerHTML resets cursor position on every keystroke)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = (cmd) => {
    ref.current?.focus();
    document.execCommand(cmd, false, null);
    const html = ref.current?.innerHTML ?? '';
    onChange(html);
    setEmpty(!html || html === '<br>');
  };

  const handleInput = (e) => {
    const html = e.currentTarget.innerHTML;
    onChange(html);
    setEmpty(!html || html === '<br>');
  };

  return (
    <div style={{ border: '1px solid #dadce0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 2, padding: '5px 8px', borderBottom: '1px solid #dadce0', background: '#f8f9fa' }}>
        {TOOLS.map(t => (
          <button key={t.cmd} type="button"
            onMouseDown={e => { e.preventDefault(); exec(t.cmd); }}
            style={{ border: '1px solid transparent', borderRadius: 5, padding: '3px 9px', fontSize: 12, cursor: 'pointer', background: 'transparent', color: '#5f6368', fontFamily: 'Google Sans,Roboto,sans-serif', ...t.style }}
            onMouseEnter={e => e.currentTarget.style.background = '#e8eaed'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Editable area + placeholder overlay ── */}
      <div style={{ position: 'relative', minHeight: 96 }}>
        {/* Placeholder */}
        {empty && (
          <div style={{
            position: 'absolute', top: 10, left: 12,
            color: '#9aa0a6', fontSize: 13, lineHeight: 1.6,
            pointerEvents: 'none', userSelect: 'none',
            fontFamily: 'Roboto,sans-serif',
          }}>
            {placeholder}
          </div>
        )}
        {/* Editable */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{
            minHeight: 96, padding: '10px 12px',
            fontSize: 13, lineHeight: 1.6,
            outline: 'none', color: '#3c4043',
            fontFamily: 'Roboto,sans-serif',
          }}
        />
      </div>
    </div>
  );
}
