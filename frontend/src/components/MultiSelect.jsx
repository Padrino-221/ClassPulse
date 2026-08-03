import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlass, CaretDown } from '@phosphor-icons/react';

export default function MultiSelect({ label, options = [], value = [], onChange, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);

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
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setFocusedIndex(-1);
        return;
      }
      const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      );
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < filtered.length - 1 ? prev + 1 : 0;
          const el = document.getElementById(`ms-item-${next}`);
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filtered.length - 1;
          const el = document.getElementById(`ms-item-${next}`);
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filtered.length) {
        e.preventDefault();
        toggle(filtered[focusedIndex].value);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, options, query, focusedIndex, value]);

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
      <label htmlFor="ms-trigger">{label}</label>
      <button
        type="button"
        id="ms-trigger"
        ref={triggerRef}
        className="ms-trigger"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selectedLabels.length ? 'ms-trigger-text' : 'ms-trigger-placeholder'}>
          {selectedLabels.length
            ? selectedLabels.length <= 2
              ? selectedLabels.join(', ')
              : `${selectedLabels.length} selected`
            : `Select ${label || 'items'}`}
        </span>
        <CaretDown size={14} weight="duotone" className={`ms-caret${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="ms-dropdown" style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width }} role="listbox" aria-label={label}>
          <div className="ms-search">
            <MagnifyingGlass size={14} weight="duotone" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusedIndex(-1); }}
              autoFocus
              aria-label="Search options"
            />
          </div>
          <div className="ms-list">
            {filtered.length === 0 && (
              <div className="ms-empty">No matches</div>
            )}
            {filtered.map((o, idx) => (
              <label
                key={o.value}
                id={`ms-item-${idx}`}
                className={`ms-item${value.includes(o.value) ? ' selected' : ''}${idx === focusedIndex ? ' focused' : ''}`}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <input
                  type="checkbox"
                  checked={value.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  tabIndex={-1}
                />
                <span className="ms-check" aria-hidden="true" />
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
