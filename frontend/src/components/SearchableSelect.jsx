import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * SearchableSelect — native-select replacement with type-to-filter search.
 *
 * Props:
 *   value       string|number  controlled value
 *   onChange    (val: string) => void
 *   options     [{value, label}]  flat list  (use this OR groups, not both)
 *   groups      [{label, options:[{value,label}]}]  grouped list
 *   placeholder string
 *   hasError    bool   — red border
 *   disabled    bool
 *   style       object — extra container styles
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  groups = [],
  placeholder = '— Select —',
  hasError = false,
  disabled = false,
  style = {},
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  // Flatten for label lookup
  const allOptions = useMemo(() => {
    const flat = [...options];
    groups.forEach(g => flat.push(...g.options));
    return flat;
  }, [options, groups]);

  const selectedLabel = allOptions.find(o => String(o.value) === String(value))?.label ?? '';

  // Filter matching options
  const q              = search.toLowerCase();
  const filteredFlat   = options.filter(o => o.label.toLowerCase().includes(q));
  const filteredGroups = groups
    .map(g => ({ ...g, options: g.options.filter(o => o.label.toLowerCase().includes(q)) }))
    .filter(g => g.options.length > 0);
  const hasItems = filteredFlat.length > 0 || filteredGroups.length > 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const select = val => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const isSelected = val => String(val) === String(value);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* ── Trigger ── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && setOpen(v => !v); }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          border: `1.5px solid ${hasError ? '#dc2626' : open ? 'var(--accent, #3b5bdb)' : 'var(--line, #dee2e6)'}`,
          borderRadius: 9,
          background: disabled ? 'var(--paper, #f8f9fa)' : '#fff',
          cursor: disabled ? 'default' : 'pointer',
          fontSize: 14,
          color: selectedLabel ? 'var(--ink, #1a1a2e)' : 'var(--ink3, #9ca3af)',
          userSelect: 'none',
          minHeight: 38,
          outline: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selectedLabel || placeholder}
        </span>
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, marginLeft: 6, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--ink3, #9ca3af)' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: '#fff',
            border: '1.5px solid var(--line, #dee2e6)',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,.12)',
            overflow: 'hidden',
          }}
        >
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line2, #f1f3f5)' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%',
                border: '1px solid var(--line, #dee2e6)',
                borderRadius: 7,
                padding: '6px 10px',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                color: 'var(--ink, #1a1a2e)',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {/* Clear / placeholder row */}
            <div
              role="option"
              aria-selected={!value}
              className="ss-placeholder"
              onMouseDown={() => select('')}
            >
              {placeholder}
            </div>

            {/* Flat options */}
            {filteredFlat.map(o => (
              <div
                key={o.value}
                role="option"
                aria-selected={isSelected(o.value)}
                className="ss-option"
                onMouseDown={() => select(String(o.value))}
              >
                {o.label}
              </div>
            ))}

            {/* Grouped options */}
            {filteredGroups.map(g => (
              <div key={g.label}>
                <div className="ss-group-header">{g.label}</div>
                {g.options.map(o => (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={isSelected(o.value)}
                    className="ss-option ss-option--indented"
                    onMouseDown={() => select(String(o.value))}
                  >
                    {o.label}
                  </div>
                ))}
              </div>
            ))}

            {!hasItems && (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--ink3, #9ca3af)', textAlign: 'center' }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
