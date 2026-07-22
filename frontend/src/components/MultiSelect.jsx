import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, CaretDown } from '@phosphor-icons/react';

export default function MultiSelect({ label, options = [], value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handler = (e) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(e.target) &&
        (!e.target.closest || !e.target.closest('.ms-dropdown'))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    const next = value.includes(val)
      ? value.filter((v) => v !== val)
      : [...value, val];
    onChange(next);
  };

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  return (
    <div className="ms-wrapper" ref={wrapperRef}>
      <label>{label}</label>
      <button
        type="button"
        ref={triggerRef}
        className="ms-trigger"
        onClick={() => setOpen((p) => !p)}
      >
        <span className={selectedLabels.length ? 'ms-trigger-text' : 'ms-trigger-placeholder'}>
          {selectedLabels.length
            ? selectedLabels.length <= 2
              ? selectedLabels.join(', ')
              : `${selectedLabels.length} selected`
            : `Select ${label || 'items'}`}
        </span>
        <CaretDown size={14} weight="duotone" className={`ms-caret${open ? ' open' : ''}`} />
      </button>
      {open && createPortal(
        <div className="ms-dropdown" style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width }}>
          <div className="ms-search">
            <MagnifyingGlass size={14} weight="duotone" />
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="ms-list">
            {filtered.length === 0 && (
              <div className="ms-empty">No matches</div>
            )}
            {filtered.map((o) => (
              <label key={o.value} className={`ms-item${value.includes(o.value) ? ' selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
                <span className="ms-check" />
                <span className="ms-label">{o.label}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
