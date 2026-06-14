import { useRef } from 'react';

const TOOLS = [
  { cmd: 'bold',                icon: 'B',       style: { fontWeight: 700 } },
  { cmd: 'italic',              icon: 'I',       style: { fontStyle: 'italic' } },
  { cmd: 'underline',           icon: 'U',       style: { textDecoration: 'underline' } },
  { cmd: 'insertUnorderedList', icon: '• List',  style: {} },
  { cmd: 'insertOrderedList',   icon: '1. List', style: {} },
];

export default function WysiwygEditor({ value, onChange, placeholder = 'Add description…' }) {
  const ref = useRef();

  const exec = (cmd) => {
    document.execCommand(cmd, false, null);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? '');
  };

  return (
    <>
      <style>{`
        [data-wysiwyg]:empty:before {
          content: attr(data-placeholder);
          color: var(--ink3);
          pointer-events: none;
        }
      `}</style>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 2, padding: '5px 8px', borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
          {TOOLS.map(t => (
            <button
              key={t.cmd}
              type="button"
              onMouseDown={e => { e.preventDefault(); exec(t.cmd); }}
              style={{
                border: '1px solid transparent',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 12,
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--ink2)',
                fontFamily: 'var(--fm)',
                ...t.style,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--line2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {t.icon}
            </button>
          ))}
        </div>
        {/* Editable area */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: value }}
          onInput={e => onChange(e.currentTarget.innerHTML)}
          data-placeholder={placeholder}
          data-wysiwyg
          style={{
            minHeight: 90,
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.6,
            outline: 'none',
            color: 'var(--ink)',
          }}
        />
      </div>
    </>
  );
}
