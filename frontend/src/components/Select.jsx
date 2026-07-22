import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Select({ children, className = '', style, name, value, onChange, ...props }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const options = React.Children.toArray(children).filter(
    (child) => child.type === 'option'
  );

  const selectedOption = options.find((opt) => opt.props.value === value);
  const selectedLabel = selectedOption?.props?.children || value || '';

  const positionDropdown = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
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
    },
    [name, value, onChange]
  );

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
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
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

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
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(
        <ul className="custom-select-dropdown" role="listbox" style={dropdownStyle}>
          {options.map((opt) => {
            const optValue = opt.props.value;
            return (
              <li
                key={optValue}
                role="option"
                aria-selected={optValue === value}
                className={`custom-select-option${optValue === value ? ' selected' : ''}`}
                onMouseDown={() => handleSelect(optValue)}
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
