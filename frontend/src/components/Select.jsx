import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Select({ children, className = '', style, name, value, onChange, 'aria-label': ariaLabel, ...props }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const [activeIndex, setActiveIndex] = useState(-1);

  const options = React.Children.toArray(children).filter(
    (child) => child.type === 'option'
  );

  const selectedOption = options.find((opt) => opt.props.value === value);
  const selectedLabel = selectedOption?.props?.children || value || '';

  const positionDropdown = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < 208;
    setDropdownStyle({
      position: 'fixed',
      top: flipUp ? rect.top - 208 - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: '240px',
      zIndex: 9999,
    });
  }, []);

  const handleSelect = useCallback(
    (optValue) => {
      setOpen(false);
      if (optValue !== value) {
        const event = { target: { name, value: optValue } };
        onChange?.(event);
      }
      setActiveIndex(-1);
    },
    [name, value, onChange]
  );

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    const handleScroll = () => positionDropdown();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, positionDropdown]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev < options.length - 1 ? prev + 1 : 0;
          const el = document.getElementById(`select-option-${next}`);
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev > 0 ? prev - 1 : options.length - 1;
          const el = document.getElementById(`select-option-${next}`);
          el?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) handleSelect(opt.props.value);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, options, activeIndex, handleSelect]);

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper ${className}`}
      style={{ position: 'relative', ...style }}
      {...props}
    >
      <button
        type="button"
        className="custom-select"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        id="custom-select-trigger"
      >
        <span className="custom-select-label">{selectedLabel}</span>
      </button>
      <svg
        className={`custom-select-chevron${open ? ' open' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(
        <ul className="custom-select-dropdown" role="listbox" style={dropdownStyle} aria-labelledby="custom-select-trigger">
          {options.map((opt, idx) => {
            const optValue = opt.props.value;
            return (
              <li
                key={optValue}
                id={`select-option-${idx}`}
                role="option"
                aria-selected={optValue === value}
                className={`custom-select-option${optValue === value ? ' selected' : ''}${idx === activeIndex ? ' focused' : ''}`}
                onMouseDown={() => handleSelect(optValue)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                {opt.props.children}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}
